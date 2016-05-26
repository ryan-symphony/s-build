//------------------------------------------------------------------------------
// Dependencies & configuration
//------------------------------------------------------------------------------
var gulp            = require('gulp'),

    _               = require('lodash'),
    autoprefixer    = require('gulp-autoprefixer'),
    async           = require('async'),
    awspublish      = require('gulp-awspublish'),
    browserify      = require('browserify'),
    browsersync     = require('browser-sync'),
    buffer          = require('vinyl-buffer'),
    bulkify         = require('bulkify'),
    cache           = require('gulp-cached'),
    cleanCss        = require('gulp-clean-css'),
    debug           = require('gulp-debug'),
    declare         = require('gulp-declare'),
    del             = require('del'),
    detachkify      = require('detachkify'),
    exit            = require('gulp-exit'),
    filter          = require('gulp-filter'),
    fs              = require('fs'),
    remoteSrc       = require('gulp-remote-src'),
    greplace        = require('gulp-replace'),
    git             = require('gift'),
    gitRepo         = git(process.env.INIT_CWD),
    gulpif          = require('gulp-if'),
    hbsify          = require('hbsify'),
    install         = require("gulp-install"),
    jasmine         = require('gulp-jasmine-phantom'),
    jshint          = require('gulp-jshint'),
    karma           = require('karma-as-promised'),
    moment          = require('moment'),
    notify          = require('gulp-notify'),
    plumber         = require('gulp-plumber'),
    rename          = require('gulp-rename'),
    runSequence     = require('run-sequence'),
    sass            = require('gulp-sass'),
    sassify         = require('sassify'),
    servestatic     = require('serve-static'),
    source          = require('vinyl-source-stream'),
    sourcemaps      = require('gulp-sourcemaps'),
    sprity          = require('sprity'),
    streamify       = require('gulp-streamify'),
    stringify       = require('stringify'),
    symphonyApi     = require('symphony-api'),
    uglify          = require('gulp-uglify'),
    util            = require('gulp-util'),
    gulpHandlebars = require('gulp-prototype-handlebars');

// File paths / Brand config / AWS config
var SRC = process.env.INIT_CWD+'/source',
    MASTER  = process.env.INIT_CWD+'/dist',
    STAGING = process.env.INIT_CWD+'/build',
    DESTINATION,
    BRAND_CONFIG = require(SRC+'/config/brand.json'),
    APP_CONFIG = require(SRC+'/config/apps.json'),
    PIXEL_CONFIG = require(SRC+'/config/pixels.json'),
    PARTIAL_CONFIG = require(SRC+'/config/partials.json'),
    BRANCH,
    IS_DEV,
    IS_TEST,
    IS_PROD,
    SITE = BRAND_CONFIG.brandName,
    RELEASE_URL = BRAND_CONFIG.releaseUrl,
    PROD_URL = BRAND_CONFIG.prodUrl,
    DEMO_URL = BRAND_CONFIG.demoUrl,
    S3 = "//s3.amazonaws.com/sneakpeeq-sites",
    CDN = "//d20b8ckvu6gb0w.cloudfront.net",
    CDN_DISTRIBUTION = "E22D8423IZOVSC",
    LIVE_BUNDLE_JS_NAME = "master.".concat(SITE, ".min.js.gz"),
    LIVE_BUNDLE_JS_PATH = "/".concat(SITE, "/styles/dist/")
        .concat(LIVE_BUNDLE_JS_NAME),

    LIVE_BUNDLE_CSS_NAME = "master.".concat(SITE, ".min.css.gz"),
    LIVE_BUNDLE_CSS_PATH = "/".concat(SITE, "/styles/dist/")
        .concat(LIVE_BUNDLE_CSS_NAME),

    LIVE_BUNDLE_SPRITE_NAME = "sprite.png",
    LIVE_BUNDLE_SPRITE_PATH = "/".concat(SITE, "/styles/dist/")
        .concat(LIVE_BUNDLE_SPRITE_NAME),

    STAGING_BUNDLE_SPRITE_NAME = "sprite.png",
    STAGING_BUNDLE_SPRITE_PATH = "/".concat(SITE, "/styles/build/")
        .concat(STAGING_BUNDLE_SPRITE_NAME),

    TIME_STAMP = moment().format('YYYY-MM-DD hh:mm:ss'),
    AWS_HEADERS = {
        'Cache-Control': 'max-age=315360000, no-transform, public'
    },
    AWS =  util.env.local ?
        JSON.parse(fs.readFileSync(process.env.INIT_CWD+'/aws.json', 'utf8')) :
        {
            params: {
                Bucket: process.env.AWS_BUCKET ?
                          process.env.AWS_BUCKET :
                          'sneakpeeq-sites'
            },
            accessKeyId: process.env.AWS_ACCESSKEY,
            secretAccessKey: process.env.AWS_SECRETKEY
        },
    publisher = awspublish.create(AWS),
    symphonyApi = symphonyApi({
        env: util.env.release ? "manage-release" : "manage",
        email: process.env.SYMPHONY_EMAIL,
        password: process.env.SYMPHONY_PASSWORD
    });

// Supported browsers
var browserSupport = {
  browsers: [
    'last 2 version',
    'safari 5',
    'ie 9',
    'ios 6',
    'android 4'
  ]
};

// Error handling
function onError(error) {
  var errorTitle = '['.concat(error.plugin, ']'),
    errorString = error.message;

  notify.onError({
    title:    errorTitle,
    message:  errorString,
    sound:    "Beep"
  })(error);
  this.emit('end');
}

//------------------------------------------------------------------------------
// Environments & Branches
//------------------------------------------------------------------------------
gulp.task('env:setup', function() {
  if (IS_DEV && BRANCH === 'master') {
    console.log("-----------------------------------\n"
      .concat("Please don't develop on master.\n")
      .concat("Create a new branch for each development feature.\n")
      .concat("-----------------------------------")
    );
    process.exit(1);
    return;
  }

  if (!IS_DEV && BRANCH !== 'master' && !IS_TEST) {
    console.log("-----------------------------------\n"
      .concat("You can only deploy master.\n")
      .concat("-----------------------------------")
    );
    process.exit(1);
    return;
  }

  DESTINATION = IS_DEV ? STAGING : MASTER;

  return gulp.src([
    SRC + '/js/package.json',
    SRC + '/bower.json'
  ])
  .pipe(install());
});

gulp.task('env:test', function () {
  IS_TEST = true;
  BRANCH = "master";
});

gulp.task('env:develop', function () {
  IS_DEV = true;
});

gulp.task('env:production', function () {
  IS_PROD = true;
});

gulp.task('build-clean', function () {
  var toDelete = [
    MASTER,
    STAGING
  ];

  if (!process.env.SNIPPET) {
    toDelete.push(
      SRC+"/js/pixels",
      SRC+"/js/apps"
    );
  }

  return del(toDelete, {
    force: true
  });
});
//-----------
// Snippets
//-----------
function cloneGit(moduleType, config) {
  var gitUrl = "https://github.com/symphony-snippets/";

  function cloneSnippet(snippet, callback) {
    git.clone(gitUrl + snippet.moduleName, SRC + "/js/" + moduleType + "/" + snippet.moduleName, function(err, repo) {
      if (!snippet.version) {
        return callback();
      }

      repo.checkout(snippet.version, callback);
    });
  }

  return new Promise(function(resolve, reject) {
    var queue = async.queue(cloneSnippet);
    queue.drain = function(err) {
      if (err) {
        reject();
        return;
      }

      resolve();
    }

    if (_.isEmpty(config)) {
      resolve();
      return;
    }

    _.each(config, function(modules, pageType) {
      _.each(modules, function(moduleConfig, moduleName) {
        queue.push({
          moduleName: moduleName,
          version: moduleConfig.version
        });
      });
    })
  }, 10);
}

gulp.task('clone-apps', function() {
  return cloneGit("apps", APP_CONFIG);
});

gulp.task('clone-pixels', function() {
  return cloneGit("pixels", PIXEL_CONFIG);
});
//-------------
// Cache Bust
//-------------
gulp.task('cache-bust', function() {
  return symphonyApi.PageElement.getPageElements(SITE)
  .then(function(pageElements) {
    var headerSnippet = _.find(pageElements, {elementKey: "headerSnippet"});
    if (!headerSnippet || !headerSnippet.textContent) {
      console.log("-----------------------------------\n"
        .concat("Problems locating headersnippet.  Please check symphony credentials.\n")
        .concat("-----------------------------------")
      );
      process.exit(1);
      return;
    }

    var newHeaderContent = _.map(headerSnippet.textContent.split("\n"), function(row) {
      if (!_.contains(row, LIVE_BUNDLE_JS_NAME) &&
          !_.contains(row, LIVE_BUNDLE_CSS_NAME)) {
        return row;
      }

      var isCSSRow = _.contains(row, LIVE_BUNDLE_CSS_NAME);
      var rowSplit = row.split("?");
      var bundleVersion = "?v=" + moment().format('YYYYMMDDhmmss');

      if (rowSplit.length > 1) {
        return rowSplit[0] + bundleVersion + "\");" + (isCSSRow ? "/>" : "");
      }

      if (isCSSRow) {
        return rowSplit[0].replace(LIVE_BUNDLE_CSS_NAME, LIVE_BUNDLE_CSS_NAME + bundleVersion);
      }

      return rowSplit[0].replace(LIVE_BUNDLE_JS_NAME, LIVE_BUNDLE_JS_NAME + bundleVersion);
    }).join("\n");

    headerSnippet.textContent = newHeaderContent;
    return headerSnippet;
  })
  .then(function(newHeader) {
    return symphonyApi.PageElement.savePageElement(SITE, newHeader);
  });
});


//------------------------------------------------------------------------------
// Javascript
//------------------------------------------------------------------------------
//----------
// JS Hint
//----------
gulp.task('js-hint', function() {
  return gulp.src([
    SRC.concat('/js/**/*.js'),
    '!'.concat(SRC, '/**/node_modules/*.*'),
    '!'.concat(SRC, '/**/node_modules/**/*.*'),
    '!'.concat(SRC, '/**/pixels/node_modules/*.*'),
    '!'.concat(SRC, '/**/apps/node_modules/*.*')
  ])
  .pipe(cache('js'))
  .pipe(jshint({
    'expr': true,
    'newcap': false
  }))
  .pipe(jshint.reporter('jshint-stylish'))
  .pipe(jshint.reporter('fail'))
  .on('error', function(error) {
    var errorTitle = '['.concat(error.plugin, ']'),
      errorString = error.message;
    notify.onError({
      title:    errorTitle,
      message:  errorString,
      sound:    "Beep"
    })(error);
    this.emit('end');
  });
});

//-------------
// Browserify
//-------------
gulp.task('browserify', ['js-hint', 'handlebars-compile'], function() {
  var bundleName = BRANCH.concat(".", SITE, ".min.js");

  return browserify({
    "entries": './entry.js',
    "ignore-missing": true,
    "debug": true
  })
  .transform(detachkify, {
    relativeTo: SRC,
    verbose: false
  })
  .transform(hbsify)
  .transform(stringify(['.html', '.csv', '.txt']))
  .transform(sassify, {
    'auto-inject': true
  })
  .transform(bulkify)
  .bundle()

  // Error Handling
  .on('error', function(error) {
    console.log(error);
    var errorTitle = '[' + error.plugin + ']',
        errorString = error.message;

    notify.onError({
        title:    errorTitle,
        message:  errorString,
        sound:    "Beep"
    })(error);
    this.emit('end');
  })

  .pipe(source(bundleName))
  .pipe(greplace('{THIS_BRANCH}', BRANCH))
  .pipe(greplace('{DEPLOY_TIME}', TIME_STAMP))
  .pipe(streamify(uglify()))
  .pipe(gulp.dest(DESTINATION))
  .pipe(buffer())
  .pipe(rename(function (path) {
    path.dirname += '/'.concat(SITE, '/styles/', IS_DEV ? "build" : "dist");
  }))
  .pipe(gulpif(util.env.upload || IS_PROD, awspublish.gzip({ ext: '.gz' })))
  .pipe(gulpif(util.env.upload || IS_PROD, publisher.publish(AWS_HEADERS , {
    createOnly: false
  })))
  .pipe(gulpif(util.env.upload || IS_PROD, awspublish.reporter()))
  .pipe(gulpif(process.env.NODE_ENV === 'production' &&
    !IS_PROD, exit()));
});

//------------------------------------------------------------------------------
// Templates
//------------------------------------------------------------------------------
//--------------------
// Handlebars Upload
//--------------------
gulp.task('handlebars-upload', function() {
  var templateAws = _.clone(AWS, true);

  if (util.env.release) {
    templateAws.params.Bucket = "symphony-release";
  }

  var templatePublisher = awspublish.create(templateAws);

  return gulp.src([
    DESTINATION.concat("/templates/*.hbs"),
    DESTINATION.concat("/templates/*.html")
  ])
  .pipe(plumber({errorHandler: onError}))

  .pipe(buffer())
  .pipe(rename(function (path) {
    path.dirname += '/'.concat(SITE, '/templates/', IS_DEV ? "build" : "dist");
  }))
  .pipe(gulpif(util.env.upload || IS_PROD, templatePublisher.publish(null , {
    createOnly: false
  })))
  .pipe(gulpif(util.env.upload || IS_PROD, awspublish.reporter()));
});

//-------------------------
// Handlebars Compilation
//-------------------------
gulp.task('remote-partials', function () {
  if (!PARTIAL_CONFIG) {
    return;
  }

  return remoteSrc(PARTIAL_CONFIG, {
    base: (util.env.release ?
            RELEASE_URL :
            util.env.demo ?
                DEMO_URL :
                PROD_URL) + "/static/templates/sites/"
  })
  .pipe(greplace('{{', '\\{{'))
  .pipe(greplace('\\{{>', '{{>'))
  .pipe(gulp.dest(SRC.concat("/templates/partials")));
});

gulp.task('handlebars-compile', ['remote-partials'], function () {
  DESTINATION = IS_DEV ? STAGING : MASTER;
  var partialSource = {
    partials: SRC + '/templates/partials/'
  }

  try {
    fs.accessSync(partialSource.partials, fs.F_OK);
  } catch(ex) {
    console.log("no partials found");
    partialSource = {}
  }

  return gulp.src([SRC + '/templates/templates-data/*.json', SRC + '/config/templates/*.json'])
             .pipe(gulpHandlebars(partialSource))
             .pipe(gulp.dest(DESTINATION.concat("/templates")));
});

//------------------------------------------------------------------------------
// Styles Task
//------------------------------------------------------------------------------
gulp.task('styles', function() {
  return gulp.src([
      SRC.concat('/scss/**/*.scss')
  ])
  .pipe(plumber({errorHandler: onError}))

  // Compile
  .pipe(sourcemaps.init())
  .pipe(sass({
      outputStyle: 'compressed'
  }))


  // Autoprefix & Minify
  .pipe(gulpif(IS_DEV, sourcemaps.init({loadMaps: true})))
  .pipe(autoprefixer( browserSupport ))
  .pipe(cleanCss())
  .pipe(gulpif(IS_DEV, sourcemaps.write()))


  // Write development css
  .pipe(rename(function (path) {
      path.basename = BRANCH.concat(".", SITE);
      path.extname = '.min.css';
  }))
  .pipe(gulp.dest(DESTINATION))

  // AWS
  .pipe(buffer())
  .pipe(rename(function (path) {
      path.dirname += '/'.concat(SITE, '/styles/', IS_DEV ? "build" : "dist");
  }))
  .pipe(gulpif(util.env.upload || IS_PROD, awspublish.gzip({ ext: '.gz' })))
  .pipe(gulpif(util.env.upload || IS_PROD, publisher.publish(AWS_HEADERS , {
      createOnly: false
  })))
  .pipe(gulpif(util.env.upload || IS_PROD, awspublish.reporter()));
});

//------------------------------------------------------------------------------
// Images task
//------------------------------------------------------------------------------
gulp.task('images', function() {
  if (IS_DEV && !util.env.upload) {
    var imagemin = require('gulp-imagemin');

    return gulp.src([
        '../../source/images/**/*.png',
        '../../source/images/**/*.jpeg',
        '../../source/images/**/*.jpg',
        '../../source/images/**/*.svg'
    ])

    // Error Handling
    .pipe(plumber({errorHandler: onError}))

    // Compress & cache
    .pipe(cache('images'))

    .pipe(imagemin({
        optimizationLevel: 3,
        progressive: true,
        interlaced: true
    }))

    // Write minified images locally
    .pipe(gulp.dest(STAGING + '/images'));
  } else if (util.env.upload || IS_PROD) {

    return gulp.src(SRC.concat('/images/sprite.png'))

    .pipe(rename(function(path) {
        path.dirname += '/'.concat(SITE, '/styles/', IS_DEV ? 'build' : 'dist');
    }))
    .pipe(publisher.publish(AWS_HEADERS , {
        createOnly: false
    }))
    .pipe(awspublish.reporter());
  }
});

gulp.task('sprite-image', ['images'], browsersync.reload);

//------------------------------------------------------------------------------
// Sprites task
//------------------------------------------------------------------------------
gulp.task('sprites', function () {
  if (!fs.existsSync(SRC.concat('/sprites/'))) {
    console.log('No Sprites Found');
    return;
  }

  var spriteSRC = IS_DEV ?
    'images' :
    CDN.concat(LIVE_BUNDLE_SPRITE_PATH);

  return sprity.src({
    cachebuster: true,
    cssPath: spriteSRC,
    orientation: 'binary-tree',
    prefix: 'sprite-icon',
    processor: 'sass',
    src: '../../source/sprites/**/*.png',
    style: '_sprites.scss',
    'style-indent-size': 4
  })

  // Error Handling
  .pipe(plumber({errorHandler: onError}))

  // Send images sprite to image minification; css to styles
  .pipe(gulpif('*.png',
    gulp.dest(SRC.concat('/images')),
    gulp.dest(SRC.concat('/scss/global'))
  ));
});

//------------------------------------------------------------------------------
// Libraries
//------------------------------------------------------------------------------
gulp.task('libraries', function() {
    return gulp.src([
        SRC.concat('/libraries/**/*.js')
    ])
    .pipe(plumber({errorHandler: onError}))

    // AWS
    .pipe(buffer())
    .pipe(rename(function (path) {
        path.dirname += '/'.concat(SITE, '/libraries/');
    }))
    .pipe(gulpif(util.env.upload || IS_PROD, awspublish.gzip({ ext: '.gz' })))
    .pipe(gulpif(util.env.upload || IS_PROD, publisher.publish(AWS_HEADERS , {
        createOnly: false
    })))
    .pipe(gulpif(util.env.upload || IS_PROD, awspublish.reporter()));
});

//------------------------------------------------------------------------------
// Browsersync
//------------------------------------------------------------------------------
gulp.task('browsersync', function() {
  if (util.env.upload || process.env.NODE_ENV === 'production') {
    console.log("No need to browsersync if we plan on uploading files");
    return;
  }

  var proxyUrl = util.env.release ?
      RELEASE_URL :
      util.env.demo ?
          DEMO_URL :
          PROD_URL;

  return browsersync.init({
    notify: false,
    proxy: proxyUrl,
    https: true,
    rewriteRules: [
      {
        match: new RegExp(CDN.concat(LIVE_BUNDLE_JS_PATH)),
        fn: function() {
            return '/'.concat(BRANCH, '.', SITE, '.min.js');
        }
      },
      {
        match: new RegExp(CDN.concat(LIVE_BUNDLE_CSS_PATH)),
        fn: function() {
            return '/'.concat(BRANCH, '.', SITE, '.min.css');
        }
      }
    ],
    files: [
      STAGING.concat('/*.min.js'),
      STAGING.concat('/*.min.css')
    ],
    middleware: servestatic(STAGING)
  });
});
//------------------------------------------------------------------------------
// File Handling
//------------------------------------------------------------------------------
//--------------
// Development
//--------------
gulp.task('dev', function() {
  return gitRepo.branch(function(err, branchInfo) {
    BRANCH = process.env.CIRCLE_BRANCH || branchInfo.name;
    return runSequence('build-clean',
      'env:develop',
      'env:setup',
      'clone-apps',
      'clone-pixels',
      'sprites',
      'handlebars-compile',
      'handlebars-upload',
      'styles',
      'images',
      'browserify',
      'browsersync',
      function() {
        gulp.watch([
          'templates/**/*.hbs',
          'templates/**/*.json',
          'source/config/*.json',
          'js/**/*.js'
        ], {cwd: SRC}, ['browserify']);
        gulp.watch('scss/**/*.scss', {cwd: SRC}, ['styles']);
        gulp.watch('sprites/**/*.png', {cwd: SRC}, ['sprites']);
        gulp.watch([
          'images/**/*.png',
          'images/**/*.jpeg',
          'images/**/*.jpg',
          'images/**/*.svg'
        ], {cwd: SRC}, ['images']);
        gulp.watch('../../build/images/sprite.png', ['sprite-image']);
      }
    );
  });
});

//-------------
// Deployment
//-------------
gulp.task('deploy', function() {
  return gitRepo.branch(function(err, branchInfo) {
    BRANCH = process.env.CIRCLE_BRANCH || branchInfo.name;
    return runSequence(
      'build-clean',
      'env:production',
      'env:setup',
      'clone-apps',
      'clone-pixels',
      'libraries',
      'sprites',
      'handlebars-compile',
      'handlebars-upload',
      'styles',
      'images',
      'browserify',
      'cache-bust'
    );
  });
});
//----------
// Testing
//----------
gulp.task('test', function () {
  return runSequence('build-clean',
    'env:test',
    'env:setup',
    'browserify',
    function() {
      return karma.server.start({
        configFile: process.env.INIT_CWD + '/karma.conf.js',
        singleRun: true
      });
    }
  );
});

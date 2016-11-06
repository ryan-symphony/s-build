import _ from 'lodash';
import chalk from 'chalk';
import async from 'async';
import moment from 'moment';
import bulkRequire from 'bulk-require';
import gulp from 'gulp';
import git from 'gift';
import gulpLoadPlugins from 'gulp-load-plugins';
import runSequence from 'gulp-run-sequence';
import { exec } from 'child_process';

import cloneRepo from './clone-gitrepo.es6';
import errorHandler from './message-handler.es6';
import { messageHandler } from './message-handler.es6';

function requireJson(location) {
  let thisJson = {};

  try {
    thisJson = require(location);
  } catch(ex) {
    thisJson = {};
  }

  return thisJson;
}

function execPromise(command, cwd) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: cwd }, (error, stdout, stderr) => {
      console.log(chalk.green(`Running Command: ${command}`));
      if (error) {
        console.log(chalk.red(error));
        process.exit(1);
      }

      stdout && console.log(chalk.yellow(stdout));
      resolve(stdout);
    });
  });
}

const { INIT_CWD, NODE_ENV, DEBUG_BUILD, ENV } = process.env,
      SRC = `${INIT_CWD}/source`,
      DIST  = `${INIT_CWD}/dist`,
      BUILD = `${INIT_CWD}/build`,
      TEST = `${INIT_CWD}/test`,
      BUILD_TASKS = `${INIT_CWD}/build-tasks`,

      IS_PROD = NODE_ENV === 'production',
      IS_DEV = !IS_PROD,

      DEST = IS_DEV ? BUILD : DIST,

      coreConfig = requireJson(`./core-config`),
      packageJson = requireJson(`${INIT_CWD}/package`),
      buildConfig = requireJson(`${INIT_CWD}/build-config`),
      BRAND_CONFIG = requireJson(`${SRC}/config/brand.json`),
      {
        brandName: BRAND_NAME, 
        prodUrl: PROD_URL,
        releaseUrl: RELEASE_URL, 
        demoUrl: DEMO_URL
      } = BRAND_CONFIG,

      TIME_STAMP = moment().format('YYYY-MM-DD hh:mm:ss'),

      
      SITE_URL = ENV && BRAND_CONFIG[`${ENV}Url`] || PROD_URL,
      PLUGINS = gulpLoadPlugins({
        pattern: ['gulp-*', 'gulp.*', 'yarn-*'],
        rename: {
          'gulp-if': 'gulpif',
          'yarn-installs': 'install'
        }
      }),

      CONFIG = _.assign(coreConfig, buildConfig, 
               {SRC, BRAND_NAME, DIST, TEST, BUILD, IS_DEV, BUILD_TASKS,
                IS_PROD, DEST, SITE_URL, TIME_STAMP, packageJson,
                SHOULD_UPLOAD: PLUGINS.util.env.upload || IS_PROD});

let taskDependencies = [], 
    enabledTaskFiles = [], 
    taskSequences = {};

_.each(buildConfig.tasks, (sequence, taskName) => {
  let runFirst = ['register-tasks'];
  
  if (taskName !== "init") {
    runFirst.push('git-branch');
  }
  
  gulp.task(taskName, runFirst, done => {
    runSequence(
      ...sequence,
      done
    );
  });
});

gulp.task("install-tasks", done => {
  const enableType = IS_PROD ? 'deployEnabled' : 'devEnabled';
  async.forEachOf(buildConfig.taskGroups, (taskDetails, taskGroup, next) => {
    if (!taskDetails || (typeof taskDetails === 'object' && !taskDetails[enableType])) {
      return next();
    }

    const { sequenceWhen, version, branch } = taskDetails;

    if (sequenceWhen) {
      taskSequences[sequenceWhen] = taskSequences[sequenceWhen] || [];
      taskSequences[sequenceWhen].push(`${taskGroup}:_sequence`);
    }

    enabledTaskFiles.push(`${INIT_CWD}/build-tasks/${taskGroup}/*.gulp.js`);
    taskDependencies.push(`${INIT_CWD}/build-tasks/${taskGroup}/package.json`);
    
    const repo = taskDetails.org ? taskDetails.org : coreConfig.SNIPPETS_URL;
    cloneRepo({
      url: `${repo}taskgroup-${taskGroup}`,
      destination: `${INIT_CWD}/build-tasks/${taskGroup}`,
      version,
      branch,
    }, next);

  }, () => {


    CONFIG.taskSequences = taskSequences;
    _.assign(PLUGINS, {
      requireJson, 
      cloneRepo, 
      errorHandler, 
      messageHandler,
      execPromise
    });

    done();
  });
});

gulp.task('install-packages', ['install-tasks'], () => {
  const installDependencies = [
    `${SRC}/js/apps/*/package.json`,
    `${SRC}/js/pixels/*/package.json`,
    `${SRC}/tiles/*/package.json`,
    `${SRC}/bower.json`,
    `${INIT_CWD}/bower.json`
  ];

  console.log(PLUGINS);

  return gulp.src([
    ...installDependencies,
    ...taskDependencies
  ])
  .pipe(PLUGINS.install());
});

gulp.task('register-tasks', ['install-tasks'], () => {
  const gulpTasks = bulkRequire(`${INIT_CWD}/build-tasks`, [...enabledTaskFiles]);
  const registeredTasks = _.map(gulpTasks, (tasks, taskType) => {
    return _.map(tasks, (task, taskName) => {
      const gulpTaskName = `${taskType}:${taskName.replace(".gulp", "")}`,
            runFirst =  tasks[taskName].runFirst || [],
            thisTask = task.default.bind(this, gulp, PLUGINS, CONFIG),
            spreadParams = [gulpTaskName, [...runFirst], thisTask];

      gulp.task(...spreadParams);

      return {
        gulpTaskName,
        fileName: taskName,
        runFirst: runFirst.toString()
      }
    });
  });

  if (DEBUG_BUILD) {
    console.log(registeredTasks);
  }
});

gulp.task('git-branch', (done) => {
  if (process.env.CIRCLE_BRANCH) {
    CONFIG.BRANCH_NAME =  process.env.CIRCLE_BRANCH;
    CONFIG.IS_MASTER = process.env.CIRCLE_BRANCH === 'master';
    return done();
  }

  const gitRepo = git(process.env.INIT_CWD);
  gitRepo.branch((err, branchInfo) => {  
    if (err || (CONFIG.IS_DEV && branchInfo.name === 'master')) {
      messageHandler({
        plugin: "core",
        relativePath: "git-branch.gulp.js",
        formatted: err || "Please don't develop on master.\n" + 
                   " Create a new branch for each development feature."
      }, "fatal");
    }

    CONFIG.BRANCH_NAME = branchInfo.name;
    CONFIG.IS_MASTER = branchInfo.name === 'master';
    done();
  });
});

gulp.task('npm-version', () => {
  return execPromise('npm -v', INIT_CWD)
  .then((version) => {
    if (_.startsWith(version, '3')) {
      return;
    }

    messageHandler({
      plugin: "s-build",
      relativePath: "npm-version",
      formatted: "s-build Requires NPM Version 3\n" + 
                 " run command: 'npm install npm@3 -g' and try again"
    }, "fatal");
  })
});

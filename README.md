# Symphony Build (S-Build)

S-Build is a bootstrapping module to help standardize and share our gulp build tasks.  

All task groups include their own dependencies and all are configured by a "build-config.json" file in your projects root directory.  This config file will tell "s-build" which taskgroups to use and if they are optional tasks, when to run them.  

Most all task groups will include a "_sequence.gulp.js" file.  This is usually the entry of the task group and will descripe the sequence of events the taskgroup will take.

Taskgroups are considered a "task" if they have ".gulp.js" in the name of their file.  If they do not have this, they are not registered as a task.

To trigger s-build, you also need a "gulpfile.js" in your projects root directory...  It should looke like this:

```
require("babel-register")({
  presets: ["es2015"],
  only: function(filename) {
    return /s-build\/gulpfile\.babel.\js/.test(filename) || 
           /\.gulp\.js/.test(filename) || 
           /\.es6\.js/.test(filename) || 
           /\.spec\.js/.test(filename);
  }
});

var gulpTasks =  require('s-build/gulpfile.babel.js');
```



Some Example Build Tasks:

##Brand Build Tasks##
- https://github.com/symphony-snippets/taskgroup-dev-brand
- https://github.com/symphony-snippets/taskgroup-deploy-brand

- https://github.com/symphony-snippets/taskgroup-dev-snippets
- https://github.com/symphony-snippets/taskgroup-dev-tiles
- https://github.com/symphony-snippets/taskgroup-dev-templates

- https://github.com/symphony-snippets/taskgroup-webdev-images
- https://github.com/symphony-snippets/taskgroup-webdev-sprites

##Manage Build Tasks##
- https://github.com/symphony-snippets/taskgroup-dev-manager
- https://github.com/symphony-snippets/taskgroup-deploy-manager

##NodeApp Tasks##
- https://github.com/symphony-snippets/taskgroup-dev-nodeapp



This automated build is designed for brand sitefront development on the Symphony Commerce platform. A few tasks that this build handles:

- creates a local development server + external device browsing
- proxies production or release environments
- compiles templates, stylesheets, and scripts
- injects style updates and reloads browsers
- image compression
- generates spritesheet
- deploys assets to S3
- busts local browser caches for js/css/sprites

Track the progress of brand build at https://symphony.atlassian.net/wiki/display/COPS/brand-build

Documentation can be found at https://symphony.atlassian.net/wiki/pages/viewpage.action?pageId=17432945

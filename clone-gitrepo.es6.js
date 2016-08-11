import _ from 'lodash';
import git from 'gift';

export default (repoDetails, done) => {
  const { url, destination, version, branch } = repoDetails;
  git.clone(url, destination, (err, repo) => {
    if (err && process.env.DEBUG_BUILD) {
      console.log(err);
    }

    if ((!version && !branch) || (version === true || branch === true)) {
      return done();
    }
    
    if (!repo) {
      repo = git(destination);
    }

    const versionTag = version && (_.startsWith(version, "v") ? `tags/${version}` : `tags/v${version}`);
    repo.checkout(versionTag || branch, (err, repo) => {
      if (err) {
        console.log(err);
      }

      done();
    });
  });
}

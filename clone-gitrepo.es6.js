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

    repo.checkout(version ? `tags/${version}` : branch, (err, repo) => {
      if (err) {
        console.log(err);
      }

      done();
    });
  });
}


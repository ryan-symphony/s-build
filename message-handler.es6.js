import notifier from 'node-notifier';
import plumber from 'gulp-plumber';
import chalk from 'chalk';

function handleMessage(message, messageType = "error") {
  const messageColor = {
    error: "red",
    fatal: "red",
    warning: "yellow",
    info: "magenta",
    success: 'green'
  }

  const thisColor = messageColor[messageType];
  const isError = messageType === 'error' || messageType === 'fatal';

  console.error(
    `\n[ ${chalk.cyan(message.plugin)} ] ${messageType} in ${chalk.magenta(message.relativePath)}`,
    message.line ? (`on line ${chalk.magenta(message.line)}`) : ``,

    `\n------------------------------------\n`,
    chalk[thisColor](message.formatted),
    `\n------------------------------------\n`
  );

  if (isError) {
    notifier.notify({
      title: `[ ${message.plugin} ] ${message.relativePath}`,
      message: message.formatted,
      icon: 'false',
      sound: 'beep'
    });
  }

  if (messageType === 'fatal') {
    process.exit(1);
  }

  if (!this || !this.emit) {
    return;
  }

  this.emit('end');
}


export const messageHandler = handleMessage;
export default () => plumber({ errorHandler: handleMessage });

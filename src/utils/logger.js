const chalkModule = require('chalk');
const chalk = chalkModule.default || chalkModule;

function timestamp() {
  const now = new Date();
  return now.toTimeString().split(' ')[0];
}

const logger = {
  info: (msg, ...args) => {
    console.log(chalk.gray(`[${timestamp()}]`), chalk.blue('ℹ INFO:'), msg, ...args);
  },
  success: (msg, ...args) => {
    console.log(chalk.gray(`[${timestamp()}]`), chalk.green('✔ SUCCESS:'), msg, ...args);
  },
  warn: (msg, ...args) => {
    console.log(chalk.gray(`[${timestamp()}]`), chalk.yellow('⚠ WARN:'), msg, ...args);
  },
  error: (msg, ...args) => {
    console.error(chalk.gray(`[${timestamp()}]`), chalk.red('✖ ERROR:'), msg, ...args);
  },
  ai: (msg, ...args) => {
    console.log(chalk.gray(`[${timestamp()}]`), chalk.magenta('🤖 GEMINI:'), msg, ...args);
  },
  cmd: (user, cmd) => {
    console.log(
      chalk.gray(`[${timestamp()}]`),
      chalk.cyan('⚡ CMD:'),
      chalk.whiteBright(cmd),
      chalk.gray('from'),
      chalk.yellow(user)
    );
  }
};

module.exports = logger;

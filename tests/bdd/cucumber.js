module.exports = {
  default: {
    require: [
      'step-definitions/**/*.js'
    ],
    format: [
      'pretty',
      'json:reports/cucumber_report.json',
      'html:reports/cucumber_report.html'
    ],
    parallel: 1,
    tags: 'not @wip',
    timeout: 60000
  },
  sso: {
    require: [
      'step-definitions/**/*.js'
    ],
    format: ['pretty'],
    tags: '@sso',
    timeout: 60000
  },
  directories: {
    require: [
      'step-definitions/**/*.js'
    ],
    format: ['pretty'],
    tags: '@directories',
    timeout: 60000
  },
  documents: {
    require: [
      'step-definitions/**/*.js'
    ],
    format: ['pretty'],
    tags: '@documents',
    timeout: 60000
  },
  'archive-view': {
    require: [
      'step-definitions/**/*.js'
    ],
    format: ['pretty'],
    tags: '@archive-view',
    timeout: 60000
  }
};

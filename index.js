'use strict'
const { promisify } = require('util')
const writeFile = promisify(require('fs').writeFile)
const { join } = require('path')
const mkdirp = require('mkdirp')
const stripIndents = require('common-tags').stripIndents
const prettyMs = require('pretty-ms')
const benchmark = require('./lib/recordBenchmark')
const generateSvg = require('./lib/generateSvg')

const LIMIT_RUNS = 3

const fixtures = [
  {
    name: 'react-app',
    mdDesc: '## React app\n\nThe app\'s `package.json` [here](./fixtures/react-app/package.json)'
  },
  // {
  //   name: 'ember-quickstart',
  //   mdDesc: '## Ember app\n\nThe app\'s `package.json` [here](./fixtures/ember-quickstart/package.json)'
  // },
  // {
  //   name: 'angular-quickstart',
  //   mdDesc: '## Angular app\n\nThe app\'s `package.json` [here](./fixtures/angular-quickstart/package.json)'
  // },
  // {
  //   name: 'medium-size-app',
  //   mdDesc: '## Medium Size App\n\nThe app\'s `package.json` [here](./fixtures/medium-size-app/package.json)'
  // },
  // {
  //   name: 'alotta-files',
  //   mdDesc: '## Lots of Files\n\nThe app\'s `package.json` [here](./fixtures/alotta-files/package.json)'
  // }
]

const tests = [
  'firstInstall',
  'repeatInstall',
  'withWarmCacheAndLockfile',
  // 'withWarmCache',
  'withLockfile',
  // 'withWarmCacheAndModules',
  'withWarmModulesAndLockfile',
  // 'withWarmModules'
]

const testDescriptions = [
  [ // firstInstall
    'clean install'
  ],
  [ // repeatInstall
    'with cache',
    'with lockfile',
    'with node_modules'
  ],
  [ // withWarmCacheAndLockfile
    'with cache',
    'with lockfile'
  ],
  // [ // withWarmCache
  //   'with cache'
  // ],
  [ // withLockfile
    'with lockfile'
  ],
  // [ // withWarmCacheAndModules
  //   'with cache',
  //   'with node_modules'
  // ],
  [ // withWarmModulesAndLockfile
    'with node_modules',
    'with lockfile'
  ],
  // [ // withWarmModules
  //   'with node_modules'
  // ]
]

const toArray = (pms, resultsObj) => {
  /**
   * Make array of all similar installs grouped together:
   * [
   *   [ npm.firstInstall, yarn.firstInstall, pnpm.firstInstall ],
   *   [ npm.repeatInstall, yarn.repeatInstall, pnpm.repeatInstall ],
   *   ...
   * ]
   */
  return tests
    .map((test) => pms
      .map((pm) => resultsObj[pm][test])
      .map((time) => Math.round(time / 100) / 10) // round to `x.x` seconds
    )
}

run()
  .then(() => console.log('done'))
  .catch(err => console.error(err))

async function run () {
  const pms = [ 'npmci', 'npm', 'yarn', 'pnpm' ]
  const sections = []
  const svgs = []
  for (const fixture of fixtures) {
    const npmciRest = average(await benchmark('npmci', fixture.name, {limitRuns: LIMIT_RUNS}))
    const npmRes = average(await benchmark('npm', fixture.name, {limitRuns: LIMIT_RUNS}))
    const yarnRes = average(await benchmark('yarn', fixture.name, {limitRuns: LIMIT_RUNS}))
    const pnpmRes = average(await benchmark('pnpm', fixture.name, {limitRuns: LIMIT_RUNS}))
    const resArray = toArray(pms, {
      'npmci': npmciRest,
      'npm': npmRes,
      'yarn': yarnRes,
      'pnpm': pnpmRes
    })

    sections.push(stripIndents`
      ${fixture.mdDesc}

      | action  | cache | lockfile | node_modules| npm ci | npm | Yarn | pnpm |
      | ---     | ---   | ---      | ---         | --- | --- | --- | --- |
      | install |       | ✔        |             | ${prettyMs(npmciRest.firstInstall)} | ${prettyMs(npmRes.firstInstall)} | ${prettyMs(yarnRes.firstInstall)} | ${prettyMs(pnpmRes.firstInstall)} |
      | install | ✔    | ✔        | ✔           | ${prettyMs(npmciRest.repeatInstall)} | ${prettyMs(npmRes.repeatInstall)} | ${prettyMs(yarnRes.repeatInstall)} | ${prettyMs(pnpmRes.repeatInstall)} |
      | install | ✔    | ✔        |             | ${prettyMs(npmciRest.withWarmCacheAndLockfile)} | ${prettyMs(npmRes.withWarmCacheAndLockfile)} | ${prettyMs(yarnRes.withWarmCacheAndLockfile)} | ${prettyMs(pnpmRes.withWarmCacheAndLockfile)} |
      | install |      | ✔        |             | ${prettyMs(npmciRest.withLockfile)} | ${prettyMs(npmRes.withLockfile)} | ${prettyMs(yarnRes.withLockfile)} | ${prettyMs(pnpmRes.withLockfile)} |
      | install |      | ✔        | ✔           | ${prettyMs(npmciRest.withWarmModulesAndLockfile)} | ${prettyMs(npmRes.withWarmModulesAndLockfile)} | ${prettyMs(yarnRes.withWarmModulesAndLockfile)} | ${prettyMs(pnpmRes.withWarmModulesAndLockfile)} |

      ![Graph of the ${fixture.name} results](./results/imgs/${fixture.name}.svg)
    `)

    svgs.push({
      path: join(__dirname, 'results', 'imgs', `${fixture.name}.svg`),
      file: generateSvg(resArray, pms, testDescriptions)
    })
  }

  // make sure folder exists
  mkdirp.sync(join(__dirname, 'results', 'imgs'))

  await Promise.all(
    [
      Promise.all(svgs.map((file) => writeFile(file.path, file.file, 'utf-8'))),
      writeFile('README.md', stripIndents`
        # Node package manager benchmark

        This benchmark compares the performance of [npm](https://github.com/npm/npm), [pnpm](https://github.com/pnpm/pnpm) and [yarn](https://github.com/yarnpkg/yarn).

        ${sections.join('\n\n')}`, 'utf8')
    ]
  ).catch((err) => { throw err })
}

function average (benchmarkResults) {
  const results = {}
  tests.forEach(test => {
    results[test] = benchmarkResults.map(res => res[test]).reduce(sum, 0) / benchmarkResults.length
  })
  return results
}

function sum (a, b) {
  return a + b
}

import _ from 'lodash';
import fs from 'path';
import path from 'path';
import {
  exec,
  spawn,
  wait
} from '@nebulario/core-process';
import {
  Operation,
  IO
} from '@nebulario/core-plugin-request';
import * as JsonUtil from '@nebulario/core-json';
import {
  sync
} from './dependencies'
import chokidar from 'chokidar'


export const clear = async (params, cxt) => {

  const {
    performer,
    performer: {
      type
    }
  } = params;

  if (type !== "instanced") {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }

  const {
    code: {
      paths: {
        absolute: {
          folder
        }
      }
    }
  } = performer;


  try {


  } catch (e) {
    IO.sendEvent("error", {
      data: e.toString()
    }, cxt);
    throw e;
  }

  return "NPM package cleared";
}



export const init = async (params, cxt) => {

  const {
    payload,
    module: mod,
    performer: {
      performerid,
      type,
      code: {
        paths: {
          absolute: {
            folder
          }
        }
      },
      dependents,
      module: {
        dependencies
      }
    },
    performers,
    task: {
      taskid
    }
  } = params;

  if (type !== "instanced") {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }

  //console.log("INIT NPM")
  //console.log(dependents);
  //console.log(_.map(performers, perf => perf.performerid));


  for (const dep of dependents) {

    const PerformerInfo = _.find(performers, {
      performerid: dep.moduleid
    });

    //PerformerInfo && console.log(PerformerInfo)


    if (PerformerInfo && PerformerInfo.linked) {

      const dependentDependencies = _.filter(dependencies, dependency => dependency.moduleid === dep.moduleid)

      for (const depdep of dependentDependencies) {

        const {
          filename,
          path
        } = depdep;

        JsonUtil.sync(folder, {
          filename,
          path,
          version: "link:./../" + depdep.moduleid
        });
      }


      IO.sendEvent("out", {
        data: "Linked performer dependency: " + dep.moduleid
      }, cxt);
    }

    //console.log(JSON.stringify(dependents, null, 2))
  }


  try {

    const {
      stdout,
      stderr
    } = await exec([
      'yarn install --check-files'
    ], {
      cwd: folder
    }, {}, cxt);

    stdout && IO.sendEvent("out", {
      data: stdout
    }, cxt);

    stderr && IO.sendEvent("warning", {
      data: stderr
    }, cxt);

  } catch (e) {
    IO.sendEvent("error", {
      data: e.toString()
    }, cxt);
    throw e;
  }

  return "NPM package initialized";
}

const build = (folder, cxt) => {

  exec(['rm -r dist',
    'cp -r src dist'
  ], {
    cwd: folder
  }, {}, cxt).then(() => {

    IO.sendEvent("done", {
      data: "Copy src to dist build"
    }, cxt);
  });

}

export const start = (params, cxt) => {

  const {
    performer,
    performer: {
      type
    }
  } = params;

  if (type !== "instanced") {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }

  const {
    code: {
      paths: {
        absolute: {
          folder
        }
      }
    },
    module: {
      iteration: {
        mode
      }
    }
  } = performer;


  const state = {
    started: false,
    scripts: 0
  };

  const packageJson = JsonUtil.load(path.join(folder, "package.json"));
  const buildCmd = 'build:watch:' + mode;


  if (packageJson.scripts[buildCmd]) {
    let signaling = false;
    return spawn('yarn', [buildCmd], {
      cwd: folder
    }, {
      onOutput: async function({
        data
      }) {

        if (data.includes("watching the files")) {
          state.scripts++;
          console.log("Detected script: " + state.scripts);
        }


        if (data.includes("Hash: ")) {
          if (!data.includes("ERROR in")) {
            state.scripts--;
            console.log("Script to go: " + state.scripts);
            if (state.started === false && state.scripts === 0) {
              state.started = true;
            }

            if (state.started === true) {
              if (!signaling) {
                signaling = true;
                setTimeout(function() {
                  IO.sendEvent("info", {
                    data: "Webpack build done"
                  }, cxt);
                  IO.sendEvent("done", {}, cxt);
                  signaling = false;
                }, 1000);
              }

              IO.sendEvent("out", {
                data
              }, cxt);
              return;
            }
          } else {
            IO.sendEvent("warning", {
              data
            }, cxt);
            return;
          }
        }

        IO.sendEvent("out", {
          data
        }, cxt);

      },
      onError: async ({
        data
      }) => {

        IO.sendEvent("warning", {
          data
        }, cxt);
      }
    });
  } else {

    const watchOp = async (operation, cxt) => {

      const {
        operationid
      } = operation;

      IO.sendEvent("out", {
        operationid,
        data: "Watching changes... "
      }, cxt);

      const watcher = chokidar.watch(folder, {
        ignoreInitial: true,
        depth: 99,
        ignored: (path) => path.includes('node_modules') || path.includes('RUNTIME_SIGNAL') || path.includes('dist') || path.includes('tmp')
      }).on('all', (event, path) => {

        build(folder, cxt);

      });

      while (operation.status !== "stopping") {
        await wait(2000);
      }

      watcher.close();
      await wait(100);

      IO.sendEvent("stopped", {
        operationid,
        data: ""
      }, cxt);
    }

    build(folder, cxt);

    return {
      promise: watchOp,
      process: null
    };


  }



}

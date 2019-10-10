import _ from "lodash";
import fs from "path";
import path from "path";
import { exec, spawn, wait } from "@nebulario/core-process";
import { Operation, IO } from "@nebulario/core-plugin-request";
import * as JsonUtil from "@nebulario/core-json";
import * as Performer from "@nebulario/core-performer";
import { sync } from "./dependencies";
import chokidar from "chokidar";

export const clear = async (params, cxt) => {
  const {
    performer,
    performer: {
      type,
      code: {
        paths: {
          absolute: { folder }
        }
      }
    }
  } = params;

  IO.print("warning", "Clean for npm folders is manual with this plugin!", cxt);
};

export const init = async (params, cxt) => {
  const {
    payload,
    module: mod,
    performer,
    performer: {
      performerid,
      type,
      code: {
        paths: {
          absolute: { folder }
        }
      },
      dependents,
      module: { dependencies }
    },
    performers,
    task: { taskid }
  } = params;

  if (type === "instanced") {
    Performer.link(performer, performers, {
      onLinked: depPerformer => {
        if (depPerformer.module.type === "npm") {
          IO.print("info", depPerformer.performerid + " npm linked!", cxt);

          const dependentDependencies = _.filter(
            dependencies,
            dependency => dependency.moduleid === depPerformer.performerid
          );

          for (const depdep of dependentDependencies) {
            const { filename, path } = depdep;

            JsonUtil.sync(folder, {
              filename,
              path,
              version: "link:./../" + depPerformer.performerid
            });
          }
        }
      }
    });
  }

  const instout = await exec(
    ["yarn install --check-files"],
    {
      cwd: folder
    },
    {},
    cxt
  );

  IO.sendOutput(instout, cxt);
};

const build = (folder, cxt) => {
  exec(
    ["rm -r dist", "cp -r src dist"],
    {
      cwd: folder
    },
    {},
    cxt
  ).then(() => {
    IO.print("done", "Copy src to dist build", cxt);
  });
};

export const start = (params, cxt) => {
  const {
    performer,
    performer: { type }
  } = params;

  if (type !== "instanced") {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }

  const {
    code: {
      paths: {
        absolute: { folder }
      }
    },
    module: {
      iteration: { mode }
    }
  } = performer;

  const state = {
    started: false,
    scripts: 0
  };

  const packageJson = JsonUtil.load(path.join(folder, "package.json"));
  const buildCmd = "build:watch:" + mode;

  if (packageJson.scripts[buildCmd]) {
    let signaling = false;
    return spawn(
      "yarn",
      [buildCmd],
      {
        cwd: folder
      },
      {
        onOutput: async function({ data }) {
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
                    IO.print("done", "Webpack build done", cxt);

                    signaling = false;
                  }, 1000);
                }

                IO.print(
                  "out",

                  data,
                  cxt
                );
                return;
              }
            } else {
              IO.print(
                "warning",

                data,
                cxt
              );
              return;
            }
          }

          IO.print(
            "out",

            data,
            cxt
          );
        },
        onError: async ({ data }) => {
          IO.print(
            "warning",

            data,
            cxt
          );
        }
      }
    );
  } else {
    const watchOp = async (operation, cxt) => {
      const { operationid } = operation;

      IO.print("out", "Watching changes... ", cxt);

      const watcher = chokidar
        .watch(folder, {
          ignoreInitial: true,
          depth: 99,
          ignored: path =>
            path.includes("node_modules") ||
            path.includes("dist") ||
            path.includes("tmp")
        })
        .on("all", (event, path) => {
          build(folder, cxt);
        });

      while (operation.status !== "stopping") {
        await wait(10);
      }

      watcher.close();
    };

    build(folder, cxt);

    return {
      promise: watchOp,
      process: null
    };
  }
};

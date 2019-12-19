import _ from "lodash";
import fs from "fs";
import path from "path";
import { exec, spawn, wait } from "@nebulario/core-process";
import chokidar from "chokidar";
import * as Utils from "../utils";
import * as Remote from "@nebulario/core-remote";

export const start = async (operation, params, cxt) => {
  const {
    performer,
    performer: { type },
    config: { cluster }
  } = params;

  if (type !== "instanced") {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }

  const {
    config: { cluster: performerCluster },
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
    scripts: 0,
    target: 0,
    count: 0
  };

  const buildCmd = "build:watch:" + mode;

  let signaling = false;
  let reset = false;

  const buildps = operation.spawn(
    "yarn",
    [buildCmd],
    {
      cwd: folder
    },
    {
      onOutput: async function({ data }) {
        operation.print("out", data, cxt);

        if (data.includes("watching the files")) {
          state.scripts++;
          state.target++;
          console.log("Detected script: " + state.scripts);
        }

        if (state.scripts > 1) {
          const matchTgt = data.match(/\[target:/gm);

          if (matchTgt !== null && reset) {
            reset = false;
            state.count = 0;
            state.target = 0;
          }

          console.log(matchTgt);
          var count = (matchTgt || []).length;
          state.target += count;

          if (state.target > state.scripts) {
            state.target = state.scripts;
          }
        }

        if (data.includes("Hash: ")) {
          reset = true;
          if (!data.includes("ERROR in")) {
            const matchHash = data.match(/Hash:/gm);
            console.log(matchHash);
            var count = (matchHash || []).length;
            state.count += count;

            console.log(
              `--Script ${state.target} - ${state.count} to go: ${state.target -
                state.count}`
            );
          }
        }

        if (
          (state.target === 0 && state.count) ||
          (state.target > 0 && state.target === state.count)
        ) {
          if (!signaling) {
            reset = false;
            state.count = 0;
            state.target = 0;

            signaling = true;
            setTimeout(function() {
              signaling = false;
              if (cluster && cluster.node && performerCluster.sync) {
                const distFolder = path.join(folder, "dist");
                const remotePath = path.join(
                  Utils.getRemotePath(params),
                  "dist"
                );

                operation.print(
                  "warning",
                  "Update node with build results: " +
                    cluster.node.user +
                    "@" +
                    cluster.node.host +
                    ":" +
                    cluster.node.port,
                  cxt
                );

                const buildpsUpd = Remote.context(
                  cluster.node,
                  [{ path: distFolder, type: "folder" }],
                  async ([folder], cxt) => {
                    const cmds = [
                      "rm -Rf " + remotePath,
                      "mkdir -p " + remotePath,
                      "cp -rf " + path.join(folder, "*") + " " + remotePath
                    ];

                    return cmds.join(";");
                  },
                  {
                    spawn: operation.spawn
                  },
                  cxt
                )
                  .then(buildpsUpd => buildpsUpd.promise)
                  .then(() => {
                    operation.event("done");
                    operation.print("info", "Package updated!", cxt);
                  })
                  .catch(e => {
                    cxt.logger.error("remote.update.build", {
                      performerid: performer.performerid,
                      error: e.toString()
                    });
                    operation.print("error", e.toString(), cxt);
                  });
              } else {
                operation.event("done");
                operation.print("info", "Package updated!", cxt);
              }
            }, 500);
          }
        }
      },
      onError: async ({ data }) => {
        operation.print("warning", data, cxt);
      }
    }
  );

  await buildps.promise;
};

import _ from "lodash";
import fs from "fs";
import path from "path";
import { exec, spawn, wait } from "@nebulario/core-process";
import { Operation, IO } from "@nebulario/core-plugin-request";
import * as JsonUtil from "@nebulario/core-json";
import * as Performer from "@nebulario/core-performer";
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
    count: 0
  };

  const packageJson = JsonUtil.load(path.join(folder, "package.json"));
  const buildCmd = "build:watch:" + mode;

  let signaling = false;

  const buildps = operation.spawn(
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

        var count = (data.match(/\[target:/gm) || []).length;
        state.count -= count;

        if (data.includes("Hash: ")) {
          if (!data.includes("ERROR in")) {
            state.count++;
            console.log("--Script to go: " + (state.scripts - state.count));

            if (state.scripts === state.count) {
              if (!signaling) {
                signaling = true;
                setTimeout(function() {
                  signaling = false;

                  if (cluster && cluster.node) {
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

              operation.print("out", data, cxt);
              return;
            }
          } else {
            operation.print("warning", data, cxt);
            return;
          }
        }

        operation.print("out", data, cxt);
      },
      onError: async ({ data }) => {
        operation.print("warning", data, cxt);
      }
    }
  );

  await buildps.promise;
};

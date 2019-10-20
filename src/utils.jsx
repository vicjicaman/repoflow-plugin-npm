import _ from "lodash";
import fs from "fs";
import path from "path";
import { exec, spawn, wait } from "@nebulario/core-process";
import * as JsonUtils from "@nebulario/core-json";
import * as Performer from "@nebulario/core-performer";
import chokidar from "chokidar";
import * as Remote from "@nebulario/core-remote";

export const linkDependents = (operation, performer, performers, cxt) => {
  const {
    code: {
      paths: {
        absolute: { folder }
      }
    },
    dependents,
    module: { dependencies }
  } = performer;
  const linkedPerformers = Performer.linked(performer, performers);

  for (const depPerformer of linkedPerformers) {
    if (depPerformer.module.type === "npm") {
      operation.print(
        "warning",
        depPerformer.performerid + " npm linked!",
        cxt
      );

      const dependentDependencies = _.filter(
        dependencies,
        dependency => dependency.moduleid === depPerformer.performerid
      );

      for (const depdep of dependentDependencies) {
        const { filename, path } = depdep;

        JsonUtils.sync(folder, {
          filename,
          path,
          version: "link:./../" + depPerformer.performerid
        });
      }
    }
  }
};

export const init = async (
  operation,
  {
    performer,
    performers,
    folders: { output: outputFolder, code: folder },
    config: { cluster }
  },
  cxt
) => {
  linkDependents(operation, performer, performers, cxt);

  const devps = operation.spawn(
    "yarn",
    ["install", "--check-files"],
    {
      cwd: folder
    },
    {},
    cxt
  );

  await devps.promise;

  operation.print("info", "Linked development package ready!", cxt);

  if (cluster && cluster.node && performer.linked) {
    const prodFolder = outputFolder;
    const copts = {
      cwd: folder
    };

    await exec(["mkdir -p " + prodFolder], copts, {}, cxt);

    if (fs.existsSync(path.join(folder, "yarn.lock"))) {
      await exec(
        ["cp -u yarn.lock " + path.join(prodFolder, "yarn.lock ")],
        copts,
        {},
        cxt
      );
    }

    await exec(
      ["cp -u package.json " + path.join(prodFolder, "package.json")],
      copts,
      {},
      cxt
    );

    const prodps = operation.spawn(
      "yarn",
      [("install", "--check-files", "--production=true")],
      {
        cwd: prodFolder
      },
      {},
      cxt
    );
    await prodps.promise;
    operation.print("info", "Linked production package ready!", cxt);

    operation.print(
      "warning",
      "Copy package files to " +
        cluster.node.user +
        "@" +
        cluster.node.host +
        ":" +
        cluster.node.port,
      cxt
    );
    const remotePath = getRemotePath(operation.params);
    const remps = await Remote.context(
      cluster.node,
      [{ path: prodFolder, type: "folder" }],
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
    );

    await remps.promise;
  }
};

export const getRemotePath = ({
  performer,
  config: {
    cluster: { instanceid }
  }
}) =>
  path.join(
    "${HOME}/repoflow/instances",
    instanceid,
    "modules",
    performer.performerid
  );
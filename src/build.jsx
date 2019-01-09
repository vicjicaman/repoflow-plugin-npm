import _ from 'lodash'
import path from 'path'
import {moduleExec} from './utils';
import {exec, spawn, wait, retry} from '@nebulario/core-process';
import killTree from 'tree-kill';
import {event} from './io';
import * as Request from './request';

export const clean = async (params, cxt) => {

  return {};
}

export const init = async (params, cxt) => {

  const {folder, mode, dependencies} = params;

  const initHandlerCnf = {
    onOutput: async function(data) {
      event("init.out", {
        data
      }, cxt);
    },
    onError: async (data) => {
      event("init.err", {
        data
      }, cxt);
    }
  };

  for (const cnfdep of dependencies) {
    const {
      kind,
      fullname,
      config: {
        build: {
          moduleid,
          enabled,

          linked
        }
      }
    } = cnfdep;

    if (kind !== "dependency") {
      continue;
    }

    try {

      if (linked) {
        console.log("######### Linking " + fullname + " to " + moduleid)

        await Request.handle(({
          folder
        }, cxt) => spawn('yarn', [
          'link', fullname
        ], {
          cwd: folder
        }, initHandlerCnf), params, cxt);

      } else {

        await Request.handle(({
          folder
        }, cxt) => spawn('yarn', [
          'unlink', fullname
        ], {
          cwd: folder
        }, initHandlerCnf), params, cxt);

      }

    } catch (e) {
      event("init.error", {
        data: e.toString()
      }, cxt);
    }

  }
  const installParams = ['install', '--ignore-scripts', '--check-files'];

  //if (mode === "prod") {
  //  installParams.push("--prod");
  //}

  await Request.handle(({
    folder
  }, cxt) => spawn('yarn', installParams, {
    cwd: folder
  }, initHandlerCnf), params, cxt);

  await Request.handle(({
    folder
  }, cxt) => spawn('yarn', ['link'], {
    cwd: folder
  }, initHandlerCnf), params, cxt);

  return {};
}

export const build = async (params, cxt) => {

  const state = {
    started: false,
    scripts: 0
  };

  await Request.handle(({
    folder,
    mode
  }, cxt) => spawn('yarn', ['build:watch:' + mode], {
    cwd: folder
  }, {
    onOutput: async function(data) {

      if (data.includes("Webpack is watching the files")) {
        state.scripts++;
        console.log("Detected script: " + state.scripts);
      }

      const rebuildedRegEx = new RegExp("Hash: .{20}", "g");
      const match = rebuildedRegEx.exec(data);

      if (match) {
        if (!data.includes("ERROR in")) {
          state.scripts--;
          console.log("Script to go: " + state.scripts);
          if (state.started === false && state.scripts === 0) {
            state.started = true;
          }

          if (state.started === true) {
            event("build.out.done", {
              data
            }, cxt);
            return;
          }
        } else {
          event("build.out.error", {
            data
          }, cxt);
          return;
        }
      }

      event("build.out.building", {
        data
      }, cxt);
    },
    onError: async (data) => {
      event("build.err", {
        data
      }, cxt);
    }
  }), params, cxt);

  console.log("EXPECTED OUTPUT FROM FINISHED BUILD REQUEST--------------------------");

}

export const stop = async ({
  requestid
}, cxt) => {
  Request.stop({
    requestid
  }, cxt);
}

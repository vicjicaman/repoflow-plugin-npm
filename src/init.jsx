import {spawn} from '@nebulario/core-process';
import {Operation, IO} from '@nebulario/core-plugin-request';

export const init = async (params, cxt) => {
  const {folder, mode, dependencies} = params;

  const initHandlerCnf = {
    onOutput: async function(data) {
      IO.sendEvent("init.out", {
        data
      }, cxt);
    },
    onError: async (data) => {
      IO.sendEvent("init.err", {
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

        await Operation.exec('yarn', [
          'link', fullname
        ], {
          cwd: folder
        }, initHandlerCnf, cxt);

      } else {

        await Operation.exec('yarn', [
          'unlink', fullname
        ], {
          cwd: folder
        }, initHandlerCnf, cxt);

      }

    } catch (e) {
      IO.sendEvent("init.error", {
        data: e.toString()
      }, cxt);
    }

  }

  await Operation.exec('yarn', [
    'install', '--check-files'
  ], {
    cwd: folder
  }, initHandlerCnf, cxt);

  await Operation.exec('yarn', ['link'], {
    cwd: folder
  }, initHandlerCnf, cxt);

  return {};
}

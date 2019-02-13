import _ from 'lodash'
import {spawn} from '@nebulario/core-process';
import {Operation, IO} from '@nebulario/core-plugin-request';

export const init = async (params, cxt) => {

  const {
    module: {
      moduleid,
      mode,
      fullname,
      code: {
        paths: {
          absolute: {
            folder
          }
        },
        dependencies
      }
    },
    modules/* config {
      build {
        enabled
        linked
      }
    }

    */
  } = params;

  const initHandlerCnf = {
    onOutput: async function({data}) {
      IO.sendEvent("init.out", {
        data
      }, cxt);
    },
    onError: async ({data}) => {
      IO.sendEvent("init.err", {
        data
      }, cxt);
    }
  };

  /*
  Reduce to unique dependencies
  */
  const uniqueDependencies = _.reduce(dependencies, (res, dep) => {

    const {moduleid, kind, fullname} = dep;

    if (kind !== "dependency") {
      return res;
    }

    if (!_.find(res, {moduleid})) {
      res.push({moduleid, fullname});
    }

    return res;
  }, [])

  for (const dep of uniqueDependencies) {
    const depModInfo = _.find(modules, {moduleid: dep.moduleid});

    try {

      if (depModInfo && (depModInfo.config.build.enabled && depModInfo.config.build.linked)) {

        await Operation.exec('yarn', [
          'link', dep.fullname
        ], {
          cwd: folder
        }, initHandlerCnf, cxt);

      } else {

        await Operation.exec('yarn', [
          'unlink', dep.fullname
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

  try {
    await Operation.exec('yarn', ['unlink'], {
      cwd: folder
    }, initHandlerCnf, cxt);
  } catch (e) {
    IO.sendEvent("init.error", {
      data: e.toString()
    }, cxt);
  }

  const ModInfo = _.find(modules, {moduleid});

  if (ModInfo && ModInfo.config.build.enabled) {

    await Operation.exec('yarn', [
      'install', '--check-files'
    ], {
      cwd: folder
    }, initHandlerCnf, cxt);

    await Operation.exec('yarn', ['link'], {
      cwd: folder
    }, initHandlerCnf, cxt);
  }

  return {};
}

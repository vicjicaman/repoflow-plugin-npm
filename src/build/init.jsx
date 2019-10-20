import * as Utils from "../utils";

export const start = async (operation, params, cxt) => {
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
      module: { dependencies },
      output: {
        paths: {
          absolute: { folder: outputFolder }
        }
      }
    },
    performers,
    task: { taskid },
    config
  } = params;

  if (type === "instanced") {
    await Utils.init(
      operation,
      {
        performer,
        performers,
        folders: {
          output: outputFolder,
          code: folder
        },
        config
      },
      cxt
    );
  }
};

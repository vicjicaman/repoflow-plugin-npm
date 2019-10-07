import path from "path";
import fs from "fs";
import { spawn } from "@nebulario/core-process";
import { IO } from "@nebulario/core-plugin-request";

export const start = (params, cxt) => {
  const {
    performer,
    performer: { type }
  } = params;

  if (type !== "instanced") {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }

  const {
    payload,
    code: {
      paths: {
        absolute: { folder }
      }
    },
    module: {
      iteration: { mode }
    }
  } = performer;

  const envFile = path.join(folder, ".env");
  fs.writeFileSync(envFile, payload);

  return spawn(
    "yarn",
    ["start:" + mode],
    {
      cwd: folder
    },
    {
      onOutput: async function({ data }) {
        if (data.includes("Running")) {
          IO.print("done", "", cxt);
        }

        if (data.includes("Error:")) {
          IO.print("warning", data, cxt);
        } else {
          IO.print("out", data, cxt);
        }
      },
      onError: async ({ data }) => {
        IO.print("error", data, cxt);
      }
    }
  );
};

import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import YAML from 'yamljs'

export const list = async ({
  module: {
    code: {
      paths: {
        absolute: {
          folder
        }
      }
    }
  }
}, cxt) => {
  const {pluginid} = cxt;
  const dependencies = [];

  const packageFile = path.join(folder, "package.json");

  if (fs.existsSync(packageFile)) {
    const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    const {name, version} = packageJson;
    const dependencyid = 'dependency|package.json|';

    dependencies.push({
      dependencyid: dependencyid + "name",
      kind: "inner",
      filename: "package.json",
      path: "version",
      fullname: name,
      version
    });

    const secs = ['dependencies', 'devDependencies', 'peerDependencies'];

    for (const s in secs) {
      const section = secs[s];

      for (const pkg in packageJson[section]) {
        const pathToVersion = section + "." + pkg
        dependencies.push({
          dependencyid: dependencyid + pathToVersion,
          kind: "dependency",
          filename: "package.json",
          path: pathToVersion,
          fullname: pkg,
          version: packageJson[section][pkg]
        });
      }
    }
  }

  return dependencies;
}




////////////////////////////////////////////////////////////////////////////////
// SYNC DEPENDENCY ON CODE

export const sync = async ({
  module: {
    code: {
      paths: {
        absolute: {
          folder
        }
      }
    }
  },
  dependency: {
    filename,
    path,
    version
  }
}, cxt) => {
  if (version) {
    syncJSONDependency(folder, {filename, path, version});
  }
  return {};
}

export const syncJSONDependency = (folder, {
  filename,
  path: pathToVersion,
  version
}, isYaml = false) => {

  const contentFile = path.join(folder, filename);
  const content = fs.readFileSync(contentFile, 'utf8')
  const native = isYaml
    ? YAML.parse(content)
    : JSON.parse(content);

  const modNative = _.set(native, pathToVersion, version)

  fs.writeFileSync(
    contentFile, isYaml
    ? YAML.stringify(modNative, 10, 2)
    : JSON.stringify(modNative, null, 2));
}

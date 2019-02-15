import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import YAML from 'yamljs'

export const list = async ({
  module: {
    moduleid,
    code: {
      paths: {
        absolute: {
          folder
        }
      }
    }
  },
  modules: modulesLocal
}, cxt) => {
  const {pluginid} = cxt;
  const dependencies = [];
  const fullnameIndex = {};

  for (const mod of modulesLocal) {
    const {moduleid, fullname} = mod;
    fullnameIndex[fullname] = {
      moduleid
    };
  }

  const innerPkgDep = generateJSONDependency(fullnameIndex, {
    kind: "inner",
    folder,
    filename: "package.json",
    paths: {
      fullname: "name",
      version: "version"
    }
  }, cxt);

  if (innerPkgDep) {
    dependencies.push(innerPkgDep);
  }

  const packageFile = path.join(folder, "package.json");

  if (fs.existsSync(packageFile)) {
    let packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    const secs = ['dependencies', 'devDependencies', 'peerDependencies'];

    for (const s in secs) {
      const section = secs[s];

      const dependencyid = 'dependency|package.json|';

      for (const pkg in packageJson[section]) {
        if (fullnameIndex[pkg]) {
          const pathToVersion = section + "." + pkg
          dependencies.push({
            dependencyid: dependencyid + pathToVersion,
            moduleid: fullnameIndex[pkg].moduleid,
            kind: "dependency",
            filename: "package.json",
            path: pathToVersion,
            fullname: pkg,
            version: packageJson[section][pkg],
            pluginid
          });
        }
      }
    }
  }

  return dependencies;
}

export const sync = async ({
  module: {
    moduleid,
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
  syncJSONDependency(folder, {filename, path, version});
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

export const generateJSONDependency = (fullnameIndex, {
  kind,
  folder,
  filename,
  paths: {
    fullname: pathToFullname,
    version: pathToVersion
  },
  isYaml
}, cxt) => {
  const {pluginid} = cxt;
  const contentFile = path.join(folder, filename);

  if (fs.existsSync(contentFile)) {
    const content = fs.readFileSync(contentFile, 'utf8')
    const native = isYaml
      ? YAML.parse(content)
      : JSON.parse(content);

    const fullnameValue = _.get(native, pathToFullname);
    const versionValue = _.get(native, pathToVersion);

    const fullnameModule = fullnameIndex[fullnameValue];

    if (fullnameModule) {
      return {
        dependencyid: kind + "|" + filename + "|" + pathToVersion,
        moduleid: fullnameModule.moduleid,
        kind,
        filename,
        path: pathToVersion,
        pluginid,
        fullname: fullnameValue,
        version: versionValue
      };
    }

  }

  return null;
}

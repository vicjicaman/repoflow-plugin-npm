import {wait} from '@nebulario/core-process';
import axios from 'axios'
import {IO} from '@nebulario/core-plugin-request';

export const publish = async (params, cxt) => {
  const {artifactid, module: mod} = params;
  const {paths: {
      relative
    }} = cxt

  const {
    moduleid,
    type,
    mode,
    version,
    fullname,
    url,
    commitid,
    branchid
  } = mod;

  const response = await axios.post('http://localbuild:8000/build/' + type, {
    moduleid,
    artifactid,
    type,
    mode,
    version,
    fullname,
    url,
    commitid,
    branchid,
    folder: relative
  }, {responseType: 'stream'});

  let publishOutput = null;
  let publishStreamFinished = false;
  let publishStreamError = null;

  response.data.on('error', (data) => {
    console.log("STREAM_PUBLISH_ERROR");
    publishStreamError = data.toString();
    IO.sendEvent("publish.error", {
      data: data.toString()
    }, cxt);
  });

  response.data.on('data', (raw) => {
    console.log("STREAM_PUBLISH_OUTPUT");
    const rawString = raw.toString();

    try {
      publishOutput = JSON.parse(raw.toString())
    } catch (e) {
      console.log("STREAM_PUBLISH_PARSE:" + rawString);
    }

    if (publishOutput.error) {
      publishStreamError = data.error;
    }

    IO.sendEvent("publish.out", {
      data: rawString
    }, cxt);

  });

  response.data.on('end', function() {
    publishStreamFinished = true;
    IO.sendEvent("publish.finished", {}, cxt);
  });

  while (publishStreamFinished === false && publishStreamError === null) {
    await wait(100);
  }

  if (publishOutput !== null) {
    const {artifact} = publishOutput;
    return {artifact, error: publishStreamError};
  } else {
    return {error: "INVALID_PUBLISH_OUTPUT"};
  }

}

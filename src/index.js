import path from 'path';
import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import pkg from '../package.json';

const axios = require('axios');
const axiosHttpAdapter = require('axios/lib/adapters/http');

const xmlParser = new XMLParser();
const id = pkg.name;
const pluginDir = path.resolve(global.APPDATA_PATH, 'namesoli-dns');
const logFile = path.resolve(pluginDir, 'logs.txt');

let timer;
const checkPluginDir = () => {
  fs.access(pluginDir, fs.constants.F_OK, (err) => {
    if (err) {
      fs.mkdirSync(pluginDir);
    }
  });
};
const logs = [];
const pushLog = (log) => {
  const logContent = `${(new Date()).toString()}: ${log}`;
  logs.push(logContent);
  fs.appendFileSync(logFile, `${logContent}\n`);
  if (logs.length > 300) {
    logs.shift();
  }
  global.ipc.sendToClient('logs', logs, global.childWins[`plugin-window-${id}`]);
};
const getIp = (type = 4) => new Promise(async (resolve, reject) => {
  const url = type === 6 ? 'https://ipv6.icanhazip.com' : 'https://icanhazip.com';
  try {
    const { data } = await axios.get(url, {
      adapter: axiosHttpAdapter,
      responseType: 'text',
    });
    resolve(data.trim());
  } catch (err) {
    reject(new Error(`获取 ipv${type} 失败`));
  }
});
const getRecords = (domain, apiKey) => new Promise(async (resolve, reject) => {
  try {
    const { data } = await axios.get(`https://www.namesilo.com/api/dnsListRecords?version=1&type=xml&key=${apiKey}&domain=${domain}`, {
      adapter: axiosHttpAdapter,
      responseType: 'text',
    });
    const { namesilo } = xmlParser.parse(data);
    if (+namesilo.reply.code !== 300 || namesilo.reply.detail !== 'success') {
      reject(new Error(`获取 dns 记录失败: ${namesilo.reply.detail}(${namesilo.reply.code})`));
    }
    resolve(namesilo.reply.resource_record);
  } catch (err) {
    reject(err);
  }
});
const getRecord = (sub, domain, apiKey, type = 4) => new Promise(async (resolve, reject) => {
  const recordType = type === 6 ? 'AAAA' : 'A';
  try {
    const records = await getRecords(domain, apiKey);
    const currentRecord = records.find((r) => r.host === `${sub}.${domain}` && r.type === recordType);
    if (!currentRecord) {
      reject(new Error('没有指定的 dns 记录'));
    }
  } catch (err) {
    reject(err);
  }
});
const setRecord = (sub, domain, apiKey, recordId, ip) => new Promise(async (resolve, reject) => {
  try {
    const { data } = await axios.get(`https://www.namesilo.com/api/dnsUpdateRecord?version=1&type=xml&key=${apiKey}&domain=${domain}&rrid=${recordId}&rrhost=${sub}&rrvalue=${ip}&rrttl=3600`, {
      adapter: axiosHttpAdapter,
      responseType: 'text',
    });
    const { namesilo } = xmlParser.parse(data);
    if (+namesilo.reply.code !== 300 || namesilo.reply.detail !== 'success') {
      reject(new Error(`设置 dns 记录失败: ${namesilo.reply.detail}(${namesilo.reply.code})`));
    }
    resolve(namesilo);
  } catch (err) {
    reject(new Error('设置 dns 失败'));
  }
});
const main = async (sub, domain, apiKey, type = 4) => {
  try {
    const currentRecord = await getRecord(sub, domain, apiKey, type);
    const ip = await getIp(type);
    if (ip !== currentRecord.value) {
      await setRecord(sub, domain, apiKey, currentRecord.record_id, ip);
      pushLog(`dns 已设置为: ${ip}`);
    } else {
      pushLog('记录 ip 相同');
    }
  } catch (err) {
    pushLog(err.message);
  }
};
const intervalCall = (sub, domain, apiKey, type = 4) => {
  if (type === 'both' || +type === 4) {
    main(sub, domain, apiKey, 4);
  }
  if (type === 'both' || +type === 6) {
    main(sub, domain, apiKey, 6);
  }
  timer = setTimeout(() => {
    intervalCall(sub, domain, apiKey, type);
  }, 30 * 60 * 1000);
};
const start = () => {
  const setting = global.store.get(`plugin.${id}.settings`, {});
  if (!setting['sub-domain'] || !setting.domain || !setting['api-key']) {
    console.log(setting, !setting['sub-domain'], !setting.domain, !setting['api-key']);
    pushLog('请先配置');
    return;
  }
  intervalCall(setting['sub-domain'], setting.domain, setting['api-key'], setting['ip-type']);
};
const stop = () => {
  clearTimeout(timer);
  timer = null;
};

// 加载时执行
export const pluginDidLoad = () => {
  checkPluginDir();
  const setting = global.store.get(`plugin.${id}.settings`, {});
  if (setting['start-on-bot']) {
    start();
  }
};

// 禁用时执行
export const pluginWillUnload = () => {
  stop();
};

// 插件设置表单
export const settingMenu = [
  {
    key: 'api-key',
    type: 'password',
    name: 'api key',
    required: true,
  },
  {
    key: 'sub-domain',
    type: 'input',
    name: '子域名',
    required: true,
  },
  {
    key: 'domain',
    type: 'input',
    name: '域名',
    required: true,
  },
  {
    key: 'start-on-boot',
    type: 'switch',
    name: '启动 app 时自动运行',
  },
  {
    key: 'ip-type',
    type: 'radio',
    name: 'ip 类型',
    choices: [
      {
        name: 'ipv4',
        value: 4,
      },
      {
        name: 'ipv6',
        value: 6,
      },
      {
        name: '两者',
        value: 'both',
      },
    ],
  },
];

// ipc 定义
export const ipcHandlers = [
  {
    type: 'start',
    handler: () => () => {
      start();
    },
  },
  {
    type: 'stop',
    handler: () => () => {
      stop();
    },
  },
  {
    type: 'isRunning',
    handler: () => () => Promise.resolve(!!timer),
  },
];

// 窗口选项
export const windowOptions = {
  minWidth: 320,
  width: 320,
  height: 240,
  frame: false,
  resizable: false,
  transparent: true,
  titleBarStyle: 'default',
};

import axios from 'axios';
import xmlParser from 'fast-xml-parser';
import pkg from '../package.json';

const id = pkg.name;

let timer;
const logs = [];
const pushLog = (log) => {
  logs.push(`${(new Date()).toString()}: ${log}`);
  if (logs.length > 300) {
    logs.shift();
  }
  global.ipc.sendToClient('logs', logs, global.childWins[`plugin-window-${id}`]);
};
const getIp = (type = 4) => new Promise(async (resolve, reject) => {
  const url = type === 6 ? 'https://ipv6.icanhazip.com' : 'https://icanhazip.com';
  try {
    const { data } = await axios.get(url);
    resolve(data.trim());
  } catch (err) {
    reject(new Error('获取 ip 失败'));
  }
});
const getRecords = (sub, domain, apiKey) => new Promise(async (resolve, reject) => {
  try {
    const { data } = await axios.get(`https://www.namesilo.com/api/dnsListRecords?version=1&type=xml&key=${apiKey}&domain=${domain}`, {
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
    const records = await getRecords(sub, domain, apiKey);
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
    const currentRecord = getRecord(sub, domain, apiKey, type);
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
const intervalCall = (sub, domain, apiKey, type) => {
  main(sub, domain, apiKey, type);
  timer = setTimeout(() => {
    intervalCall(sub, domain, apiKey, type);
  }, 30 * 60 * 1000);
};
const start = (type = 4) => {
  const setting = global.store.get(`plugin.${id}.settings`, {});
  intervalCall(setting['sub-domain'], setting.domain, setting['api-key'], type);
};
const stop = () => {
  clearTimeout(timer);
  timer = null;
};

// 加载时执行
export const pluginDidLoad = () => {
  const setting = global.store.get(`plugin.${id}.settings`, {});
  if (setting['start-on-bot']) {
    start(6);
  }
};

// 禁用时执行
export const pluginWillUnload = () => {
  console.log('plugin unloaded');
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
    key: 'doamin',
    type: 'input',
    name: '域名',
    required: true,
  },
  {
    key: 'start-on-boot',
    type: 'switch',
    name: '启动app时自动运行',
  },
];

// ipc 定义
export const ipcHandlers = [
  {
    type: 'start',
    handler: () => (type = 4) => {
      start(type);
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

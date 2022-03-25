import { useEffect, useState } from 'preact/hooks';
import Titlebar from './Titlebar.jsx';

const ipc = window.electron.useIpc();

const start = () => {
  ipc.send('start@translime-plugin-namesilo-dns', 4);
};

export default function Ui() {
  const [logs, setLogs] = useState([]);
  const onLog = () => {
    ipc.on('logs', (l) => {
      setLogs(l);
    });
  };

  useEffect(() => {
    onLog();
  });

  return (
    <>
      <Titlebar />

      <main className="main">
        <div>
          <button onClick={start}>start</button>
        </div>

        <div className="flex items-center mt-2">
          <div>日志</div>
          <button className="ml-2">所有日志</button>
        </div>
        <div className="text-sm w-full max-h-24 overflow-x-auto">{logs.at(-1)}</div>
      </main>
    </>
  );
}

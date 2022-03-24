const ipc = window.electron.useIpc();

const devtools = () => {
  ipc.send('devtools', 'plugin-window-translime-plugin-namesilo-dns');
};

export default function Ui() {
  return (
    <>
      <h1>Hello Vite!111</h1>
      { process.env.NODE_ENV !== 'development' ? null : <button onClick={devtools}>devtools</button> }
    </>
  );
}

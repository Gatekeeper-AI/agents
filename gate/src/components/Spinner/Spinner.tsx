import "./loading.css";

export const Spinner = ({ visible = false }: { visible?: boolean }) => {
  return (
    <div
      data-testid="spinner"
      className={`${!visible ? "hidden" : ""} absolute h-screen w-full flex items-center justify-center opacity-70 bg-slate-100 z-10 cursor-wait`}
    >
      <div className="lds-dual-ring"></div>
    </div>
  );
};
import s from "./auth.module.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.page}>
      {children}
    </div>
  );
}

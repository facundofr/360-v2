function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className=" fixed inset-x-0 bottom-0 z-[1000] bg-corporate px-5 py-2.5 text-center text-xs tracking-wide text-white/70">
      &copy; {year} <strong className="font-semibold text-white">Grupo Cober</strong> · Desarrollado por{" "}
      <strong className="font-semibold text-white">Performance marketing</strong>
    </footer>
  );
}

export default Footer;

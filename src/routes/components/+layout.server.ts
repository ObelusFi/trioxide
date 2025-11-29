
export const prerender = true;

export const load = () => {
  const modules = import.meta.glob('./*/*');
  const routes = Object.keys(modules).map(path =>
    path
      .replace('./', '')
      .replace(/\/.*/, '')
  );

  return { routes };
}
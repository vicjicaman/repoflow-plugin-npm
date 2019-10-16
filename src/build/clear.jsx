export const start = async (operation, params, cxt) => {
  operation.print(
    "warning",
    "Clean for npm folders is manual with this plugin!",
    cxt
  );
};

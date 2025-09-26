export const SignOutForm = () => {
  return (
    <button
      type="button"
      className="w-full px-1 py-0.5 text-left text-gray-500 cursor-not-allowed opacity-50"
      disabled
      title="Sign out is handled by your Databricks workspace"
    >
      Sign out (Databricks managed)
    </button>
  );
};

import "server-only";
import { forbidden, redirect } from "next/navigation";
import { requestToken } from "./http";
import { sessionUser } from "./service";
import { can, type Permission } from "./permissions";
export async function requirePage(permission?: Permission, allowPasswordChange = false) {
  const user = await sessionUser(await requestToken());
  if (!user) redirect("/login");
  if (user.mustChangePassword && !allowPasswordChange) redirect("/change-password");
  if (permission && !can(user, permission)) forbidden();
  return user;
}

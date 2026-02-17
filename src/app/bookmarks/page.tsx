import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BookmarkList from "./BookmarkList";

export default async function BookmarksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <BookmarkList user={user} />;
}

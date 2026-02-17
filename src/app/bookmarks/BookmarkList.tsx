"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

interface Bookmark {
  id: string;
  url: string;
  title: string;
  created_at: string;
  user_id: string;
}

export default function BookmarkList({ user }: { user: User }) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchBookmarks = async () => {
      const { data } = await supabase
        .from("abstrabit_bookmarks")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) setBookmarks(data);
    };

    fetchBookmarks();

    // Use Supabase Broadcast for reliable cross-tab realtime sync
    const channel = supabase
      .channel(`bookmarks_${user.id}`)
      .on("broadcast", { event: "bookmark_added" }, ({ payload }) => {
        const newBookmark = payload as Bookmark;
        setBookmarks((prev) => {
          if (prev.some((b) => b.id === newBookmark.id)) return prev;
          return [newBookmark, ...prev];
        });
      })
      .on("broadcast", { event: "bookmark_deleted" }, ({ payload }) => {
        setBookmarks((prev) => prev.filter((b) => b.id !== payload.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !title.trim()) return;

    setLoading(true);
    const { data } = await supabase
      .from("abstrabit_bookmarks")
      .insert({
        url: url.trim(),
        title: title.trim(),
        user_id: user.id,
      })
      .select()
      .single();

    if (data) {
      setBookmarks((prev) => [data, ...prev]);
      // Broadcast to other tabs
      supabase.channel(`bookmarks_${user.id}`).send({
        type: "broadcast",
        event: "bookmark_added",
        payload: data,
      });
    }
    setUrl("");
    setTitle("");
    setLoading(false);
  };

  const deleteBookmark = async (id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
    // Broadcast to other tabs
    supabase.channel(`bookmarks_${user.id}`).send({
      type: "broadcast",
      event: "bookmark_deleted",
      payload: { id },
    });
    await supabase.from("abstrabit_bookmarks").delete().eq("id", id);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Smart Bookmark</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-red-600 hover:text-red-800 cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Add Bookmark Form */}
        <form
          onSubmit={addBookmark}
          className="bg-white rounded-lg shadow-sm p-6 mb-8"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Add a Bookmark
          </h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400 bg-white"
              required
            />
            <input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400 bg-white"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? "Adding..." : "Add Bookmark"}
            </button>
          </div>
        </form>

        {/* Bookmarks List */}
        <div className="space-y-3">
          {bookmarks.length === 0 ? (
            <p className="text-center text-gray-500 py-12">
              No bookmarks yet. Add your first one above!
            </p>
          ) : (
            bookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between"
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={bookmark.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium block truncate"
                  >
                    {bookmark.title}
                  </a>
                  <p className="text-sm text-gray-400 truncate">
                    {bookmark.url}
                  </p>
                </div>
                <button
                  onClick={() => deleteBookmark(bookmark.id)}
                  className="ml-4 text-red-500 hover:text-red-700 text-sm shrink-0 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

import { supabase } from "@/integrations/supabase/client";

export type Doc = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  word_count: number;
  folder_id: string | null;
  share_token: string | null;
  share_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type Folder = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type DocVersion = {
  id: string;
  document_id: string;
  user_id: string;
  content: string;
  word_count: number;
  label: string | null;
  created_at: string;
};

export function stripHtml(html: string): string {
  if (typeof window === "undefined") return html.replace(/<[^>]*>/g, " ");
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

export function countWords(text: string) {
  const plain = /<[a-z][\s\S]*>/i.test(text) ? stripHtml(text) : text;
  const t = plain.trim();
  return t ? t.split(/\s+/).length : 0;
}

export async function listDocuments(): Promise<Doc[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Doc[];
}

export async function createDocument(
  userId: string,
  title = "Untitled",
  content = "",
  folderId: string | null = null,
): Promise<Doc> {
  const { data, error } = await supabase
    .from("documents")
    .insert({ user_id: userId, title, content, word_count: countWords(content), folder_id: folderId })
    .select("*")
    .single();
  if (error) throw error;
  return data as Doc;
}

export async function updateDocument(
  id: string,
  patch: Partial<Pick<Doc, "title" | "content" | "folder_id" | "share_enabled" | "share_token">>,
) {
  const next: {
    title?: string;
    content?: string;
    word_count?: number;
    folder_id?: string | null;
    share_enabled?: boolean;
    share_token?: string | null;
  } = {};
  if (typeof patch.title === "string") next.title = patch.title;
  if (typeof patch.content === "string") {
    next.content = patch.content;
    next.word_count = countWords(patch.content);
  }
  if (patch.folder_id !== undefined) next.folder_id = patch.folder_id;
  if (typeof patch.share_enabled === "boolean") next.share_enabled = patch.share_enabled;
  if (patch.share_token !== undefined) next.share_token = patch.share_token;
  const { data, error } = await supabase
    .from("documents")
    .update(next)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Doc;
}


export async function deleteDocument(id: string) {
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}

export async function listFolders(): Promise<Folder[]> {
  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Folder[];
}

export async function createFolder(userId: string, name = "New folder"): Promise<Folder> {
  const { data, error } = await supabase
    .from("folders")
    .insert({ user_id: userId, name })
    .select("*")
    .single();
  if (error) throw error;
  return data as Folder;
}

export async function renameFolder(id: string, name: string) {
  const { error } = await supabase.from("folders").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteFolder(id: string) {
  // Move documents in this folder to root, then delete
  await supabase.from("documents").update({ folder_id: null }).eq("folder_id", id);
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) throw error;
}

function genToken() {
  const arr = new Uint8Array(18);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
}

export async function enableShare(id: string): Promise<Doc> {
  const token = genToken();
  return updateDocument(id, { share_enabled: true, share_token: token });
}

export async function disableShare(id: string): Promise<Doc> {
  return updateDocument(id, { share_enabled: false });
}

export async function revokeShare(id: string): Promise<Doc> {
  // Hard-revoke: disable + null the token so the old URL is permanently dead.
  return updateDocument(id, { share_enabled: false, share_token: null });
}

export async function fetchDocumentMeta(id: string) {
  const { data, error } = await supabase
    .from("documents")
    .select("id,content,updated_at,title")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as null | { id: string; content: string; updated_at: string; title: string };
}

export async function fetchSharedDocument(token: string) {
  const { data, error } = await supabase.rpc("get_shared_document", { _token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as null | {
    id: string;
    title: string;
    content: string;
    word_count: number;
    updated_at: string;
  };
}

export async function listVersions(documentId: string): Promise<DocVersion[]> {
  const { data, error } = await supabase
    .from("document_versions")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DocVersion[];
}

export async function saveVersion(
  documentId: string,
  userId: string,
  content: string,
  label?: string,
): Promise<DocVersion> {
  const { data, error } = await supabase
    .from("document_versions")
    .insert({
      document_id: documentId,
      user_id: userId,
      content,
      word_count: countWords(content),
      label: label ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as DocVersion;
}

export async function deleteVersion(id: string) {
  const { error } = await supabase.from("document_versions").delete().eq("id", id);
  if (error) throw error;
}

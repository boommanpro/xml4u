import { useEffect } from "react";
import { useEditorStore } from "@/stores/editorStore";

export default function SessionDataHandler() {
  const mainEditor = useEditorStore((state) => state.main);

  useEffect(() => {
    // 从 sessionStorage 中读取数据
    const sessionData = sessionStorage.getItem("json4u_editor_data");
    if (sessionData && mainEditor) {
      mainEditor.parseAndSet(sessionData);
      // 清除已使用的数据
      sessionStorage.removeItem("json4u_editor_data");
    }
  }, [mainEditor]);

  return null;
}
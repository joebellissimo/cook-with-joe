"use client";

import { useState } from "react";
import RecipePlayer from "@/components/RecipePlayer";
import RecipeReadView from "@/components/RecipeReadView";

export default function RecipeView({ recipe }) {
  const [mode, setMode] = useState("watch");

  if (mode === "read") {
    return <RecipeReadView recipe={recipe} onWatch={() => setMode("watch")} />;
  }

  return <RecipePlayer recipe={recipe} onRead={() => setMode("read")} />;
}

import { NextResponse } from "next/server";
import { getRecipesData } from "@/lib/recipesStore";

export async function GET() {
  const data = await getRecipesData();
  return NextResponse.json(data);
}

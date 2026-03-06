import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")

  const url = new URL("/reset-password", request.url)
  if (tokenHash) url.searchParams.set("token_hash", tokenHash)
  if (type) url.searchParams.set("type", type)

  return NextResponse.redirect(url)
}

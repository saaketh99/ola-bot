import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { message, sender = "user" } = await req.json()

    // Send message to Rasa server
    const rasaResponse = await fetch("http://51.20.18.59:5005/webhooks/rest/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: sender,
        message: message,
      }),
    })

    if (!rasaResponse.ok) {
      throw new Error(`Rasa server error: ${rasaResponse.status}`)
    }

    const rasaData = await rasaResponse.json()

    // Extract bot responses
    const botResponses = rasaData.map((response: any) => ({
      text: response.text || "",
      buttons: response.buttons || [],
      image: response.image || null,
      attachment: response.attachment || null,
    }))

    return NextResponse.json({
      responses: botResponses,
      success: true,
    })
  } catch (error) {
    console.error("Chat API Error:", error)
    return NextResponse.json(
      {
        error: "Failed to communicate with chat bot",
        success: false,
        responses: [{ text: "Sorry, I'm having trouble connecting to the chat service. Please try again." }],
      },
      { status: 500 },
    )
  }
}

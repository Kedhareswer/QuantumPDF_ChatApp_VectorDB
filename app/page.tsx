import { Upload } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="hidden md:flex flex-1 pr-4">
            <Link href="/" className="flex items-center space-x-2">
              <span className="hidden font-bold sm:inline-block">PDFChat</span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            
          </div>
        </div>
      </header>
      <main className="flex-1">
        <section className="space-y-6 pb-12 pt-12 md:pb-16 md:pt-16 lg:py-32"> {/* Reduced lg:py-32 to lg:py-20 */}
          <div className="container flex max-w-[64rem] flex-col items-center gap-6 text-center px-4 mx-auto">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
              Chat with your PDF documents using AI
            </h1>
            <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
              Upload your PDFs, ask questions, and get instant answers. Our AI analyzes your documents and provides
              relevant insights.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/chat">
                <Button size="lg" className="gap-2">
                  <Upload size={16} />
                  Upload PDFs
                </Button>
              </Link>
            </div>
          </div>
        </section>
        <section className="w-full flex flex-col items-center space-y-6 py-8 md:py-12 lg:py-16">
  <div className="mx-auto flex max-w-4xl flex-col items-center space-y-6 text-center w-full">
    <h2 className="text-3xl font-bold leading-[1.1] sm:text-3xl md:text-5xl">Features</h2>
    <p className="max-w-2xl leading-normal text-muted-foreground sm:text-lg sm:leading-7 mx-auto">
      Our PDF chat application offers powerful features to help you extract insights from your documents.
    </p>
  </div>
  <div className="mx-auto grid gap-8 sm:grid-cols-2 md:grid-cols-3 w-full max-w-6xl justify-center items-stretch">
            <Card className="bg-card/50 p-6 min-h-[200px]">
              <CardHeader className="text-left">
                <CardTitle className="text-left">Multi-PDF Upload</CardTitle>
                <CardDescription className="text-left">Upload and analyze multiple PDF documents at once.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 px-2 pb-2 text-left">
                <p>Upload any number of PDFs and our system will process them for you to chat with.</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50"> {/* Added subtle background */}
              <CardHeader className="text-left">
                <CardTitle className="text-left">Smart Chunking</CardTitle>
                <CardDescription className="text-left">Documents are intelligently divided for better analysis.</CardDescription>
              </CardHeader>
              <CardContent className="text-left">
                <p>Our system breaks down documents into meaningful chunks for more accurate responses.</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50"> {/* Added subtle background */}
              <CardHeader className="text-left">
                <CardTitle className="text-left">AI-Powered Chat</CardTitle>
                <CardDescription className="text-left">Ask questions and get answers based on your documents.</CardDescription>
              </CardHeader>
              <CardContent className="text-left">
                <p>Our AI understands your questions and finds relevant information from your PDFs.</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50"> {/* Added subtle background */}
              <CardHeader className="text-left">
                <CardTitle className="text-left">Document Summaries</CardTitle>
                <CardDescription className="text-left">Get quick summaries of your entire documents.</CardDescription>
              </CardHeader>
              <CardContent className="text-left">
                <p>Generate executive summaries, bullet points, or TL;DR versions of your PDFs.</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50"> {/* Added subtle background */}
              <CardHeader className="text-left">
                <CardTitle className="text-left">Key Information Extraction</CardTitle>
                <CardDescription className="text-left">Extract tables, entities, and important data.</CardDescription>
              </CardHeader>
              <CardContent className="text-left">
                <p>Automatically identify and extract key information like tables, people, dates, and more.</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50"> {/* Added subtle background */}
              <CardHeader className="text-left">
                <CardTitle className="text-left">Multi-Document Chat</CardTitle>
                <CardDescription className="text-left">Chat with one or all of your documents at once.</CardDescription>
              </CardHeader>
              <CardContent className="text-left">
                <p>Ask questions across multiple documents and get comprehensive answers with source references.</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            &copy; {new Date().getFullYear()} PDFChat. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

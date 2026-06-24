export interface HowToDoc {
  title: string   // extracted from first # heading in the file
  order: number   // parsed from NN prefix in filename
  content: string // raw markdown string
}

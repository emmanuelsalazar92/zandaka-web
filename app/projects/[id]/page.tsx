import { ProjectDetail } from "@/components/projects"

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ProjectDetail key={id} id={id} />
}

import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  CONTAINER_TYPES,
  fetchContainers,
  fetchPages,
  nextContainerLabel,
  nextPageLabel,
  type Container,
} from "@/lib/triage";

const containersQuery = queryOptions({ queryKey: ["containers"], queryFn: fetchContainers });
const pagesQuery = queryOptions({ queryKey: ["pages"], queryFn: () => fetchPages() });

export const Route = createFileRoute("/containers")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Containers — Stamp Triage" },
      { name: "description", content: "Albums, boxes and sheets holding the collection." },
      { property: "og:title", content: "Containers — Stamp Triage" },
      {
        property: "og:description",
        content: "Albums, boxes and sheets holding the collection.",
      },
    ],
  }),
  component: Containers,
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  notFoundComponent: () => <div>Nothing here.</div>,
});

function Containers() {
  const queryClient = useQueryClient();
  const { data: containers } = useSuspenseQuery(containersQuery);
  const { data: pages } = useSuspenseQuery(pagesQuery);
  const [selected, setSelected] = useState<Container | null>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("album");
  const [description, setDescription] = useState("");

  const createContainer = useMutation({
    mutationFn: async () => {
      const label = await nextContainerLabel();
      const { error } = await supabase
        .from("containers")
        .insert({ label, type, description: description.trim() || null });
      if (error) throw error;
      return label;
    },
    onSuccess: (label) => {
      toast.success(`Container ${label} created`);
      setOpen(false);
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["containers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createPage = useMutation({
    mutationFn: async (container: Container) => {
      const label = await nextPageLabel(container.label, container.id);
      const { error } = await supabase
        .from("pages")
        .insert({ label, container_id: container.id });
      if (error) throw error;
      return label;
    },
    onSuccess: (label) => {
      toast.success(`Page ${label} created`);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const selectedPages = selected ? pages.filter((page) => page.container_id === selected.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Containers</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>New container</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New container</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTAINER_TYPES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createContainer.mutate()}
                disabled={createContainer.isPending}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Label</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Pages</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {containers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                No containers yet
              </TableCell>
            </TableRow>
          ) : (
            containers.map((container) => (
              <TableRow
                key={container.id}
                onClick={() => setSelected(container)}
                className="cursor-pointer"
                data-state={selected?.id === container.id ? "selected" : undefined}
              >
                <TableCell className="font-medium">{container.label}</TableCell>
                <TableCell>{container.type}</TableCell>
                <TableCell>{container.description ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {pages.filter((page) => page.container_id === container.id).length}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {selected ? (
        <section className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Pages in {selected.label}</h2>
            <Button
              variant="outline"
              onClick={() => createPage.mutate(selected)}
              disabled={createPage.isPending}
            >
              New page
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Capture type</TableHead>
                <TableHead>Identify status</TableHead>
                <TableHead>Captured at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedPages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No pages yet
                  </TableCell>
                </TableRow>
              ) : (
                selectedPages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="font-medium">{page.label}</TableCell>
                    <TableCell>{page.capture_type ?? "—"}</TableCell>
                    <TableCell>{page.identify_status}</TableCell>
                    <TableCell>
                      {page.captured_at ? new Date(page.captured_at).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      ) : null}
    </div>
  );
}

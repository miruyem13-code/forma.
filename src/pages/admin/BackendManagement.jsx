import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useApp } from '../../hooks/useApp';
import { Button, EmptyState, Modal, PageHeading, QueryState } from '../../components/common/UI';

export function BackendCategories() {
  const cache = useQueryClient();
  const { notify } = useApp();
  const query = useQuery({ queryKey: ['admin-categories'], queryFn: api.admin.categories });
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const mutation = useMutation({
    mutationFn: async ({ value, remove }) => {
      if (remove) return api.admin.deleteCategory(value.id);
      const data = { name: value.name, slug: value.slug, description: value.description || null };
      return value.id ? api.admin.updateCategory(value.id, data) : api.admin.createCategory(data);
    },
    onSuccess: () => { setEditing(null); setRemoving(null); cache.invalidateQueries({ queryKey: ['admin-categories'] }); cache.invalidateQueries({ queryKey: ['categories'] }); notify('Category saved.'); },
    onError: error => notify(error.message, 'error'),
  });
  return <><PageHeading title="Categories" description="Manage the topics in your course library." action={<Button onClick={() => setEditing({ name: '', slug: '', description: '' })}>Add category</Button>} />
    <QueryState query={query}><div className="category-page-grid">{query.data?.map(item => <article className="card padded" key={item.id}><h2>{item.name}</h2><p>{item.description}</p><Button variant="outline" onClick={() => setEditing(item)}>Edit</Button> <Button variant="outline" onClick={() => setRemoving(item)}>Delete</Button></article>)}</div></QueryState>
    {editing && <Modal title={editing.id ? 'Edit category' : 'Add category'} onClose={() => setEditing(null)}><form onSubmit={event => { event.preventDefault(); mutation.mutate({ value: editing }); }}>{['name', 'slug', 'description'].map(key => <label className="field" key={key}><span>{key}</span><input value={editing[key] || ''} required={key !== 'description'} pattern={key === 'slug' ? '[a-z0-9]+(?:-[a-z0-9]+)*' : undefined} onChange={event => setEditing({ ...editing, [key]: event.target.value })} /></label>)}<Button type="submit" disabled={mutation.isPending}>Save category</Button></form></Modal>}
    {removing && <Modal title="Delete category?" onClose={() => setRemoving(null)}><p>Delete {removing.name}? Categories assigned to courses cannot be deleted.</p><Button disabled={mutation.isPending} onClick={() => mutation.mutate({ value: removing, remove: true })}>Confirm delete</Button></Modal>}
  </>;
}

export function BackendReviews() {
  const cache = useQueryClient();
  const { notify } = useApp();
  const [removing, setRemoving] = useState(null);
  const query = useQuery({ queryKey: ['admin-reviews'], queryFn: api.admin.reviews });
  const mutation = useMutation({
    mutationFn: ({ item, remove }) => remove ? api.admin.deleteReview(item.id) : api.admin.moderateReview(item.id, !item.hidden),
    onSuccess: () => { setRemoving(null); cache.invalidateQueries({ queryKey: ['admin-reviews'] }); cache.invalidateQueries({ queryKey: ['courses'] }); notify('Review updated.'); },
    onError: error => notify(error.message, 'error'),
  });
  return <><PageHeading title="Learner reviews" description="Review and moderate learner feedback." /><QueryState query={query}><div className="admin-reviews">{query.data?.map(item => <article className="card padded" key={item.id}><h3>{item.name} · {item.rating}/5</h3><p>{item.text}</p><p className="muted">{item.hidden ? 'Hidden' : 'Visible'} · {item.date}</p><Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ item })}>{item.hidden ? 'Show review' : 'Hide review'}</Button> <Button variant="outline" onClick={() => setRemoving(item)}>Delete</Button></article>)}</div>{query.data?.length === 0 && <EmptyState title="No reviews yet" description="Learner reviews will appear here." />}</QueryState>{removing && <Modal title="Delete review?" onClose={() => setRemoving(null)}><p>This permanently removes the selected review.</p><Button disabled={mutation.isPending} onClick={() => mutation.mutate({ item: removing, remove: true })}>Confirm delete</Button></Modal>}</>;
}

export function UserRoleEditor({ user, onSaved }) {
  const { notify } = useApp();
  const [role, setRole] = useState(user.role);
  const cache = useQueryClient();
  const mutation = useMutation({ mutationFn: () => api.admin.role(user.id, role), onSuccess: () => { cache.invalidateQueries({ queryKey: ['admin-users'] }); cache.invalidateQueries({ queryKey: ['session'] }); notify('Role updated. This user must sign in again.'); onSaved(); }, onError: error => notify(error.message, 'error') });
  return <form onSubmit={event => { event.preventDefault(); mutation.mutate(); }}><label className="field"><span>Account role</span><select value={role} onChange={event => setRole(event.target.value)}><option value="student">Student</option><option value="admin">Administrator</option></select></label><p className="muted">Administrator access permits managing courses and users. Changing a role signs this user out.</p><Button type="submit" disabled={mutation.isPending || role === user.role}>Save role</Button></form>;
}

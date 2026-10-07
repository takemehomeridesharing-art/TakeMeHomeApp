import { type OutboxMessage } from '@tmh/shared';
import { useState } from 'react';
import { type Column, DataTable, PageHeader, Pill, SearchBox, Tabs } from '../components';
import { formatAgo, formatDateTime } from '../format';
import { useAdminList } from '../queries';

type Channel = 'all' | 'sms' | 'push';

export function OutboxPage() {
  const [channel, setChannel] = useState<Channel>('all');
  const [q, setQ] = useState('');
  const query = useAdminList<OutboxMessage>('outbox');

  // The endpoint has no filters, so filter on the client.
  const needle = q.trim().toLowerCase();
  const filtered =
    query.data?.filter(
      (m) => (channel === 'all' || m.channel === channel) && (!needle || `${m.to} ${m.body}`.toLowerCase().includes(needle)),
    ) ?? [];

  const columns: Column<OutboxMessage>[] = [
    {
      header: 'Channel',
      cell: (m) => <Pill tone={m.channel === 'sms' ? 'accent' : 'tint'}>{m.channel === 'sms' ? 'SMS' : 'Push'}</Pill>,
    },
    { header: 'To', cell: (m) => <span className="code">{m.to}</span> },
    { header: 'Message', className: 'col-wide', cell: (m) => <div className="outbox-body">{m.body}</div> },
    {
      header: 'Sent',
      cell: (m) => (
        <span className="small" title={formatDateTime(m.createdAt)}>
          {formatAgo(m.createdAt)}
        </span>
      ),
    },
  ];

  const counts = {
    all: query.data?.length,
    sms: query.data?.filter((m) => m.channel === 'sms').length,
    push: query.data?.filter((m) => m.channel === 'push').length,
  };

  return (
    <>
      <PageHeader
        title="Outbox"
        subtitle="Dev log of every SMS and push the mock providers 'sent' — including SOS alerts to trusted contacts. Newest first."
      />
      <div className="toolbar">
        <Tabs<Channel>
          value={channel}
          onChange={setChannel}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'sms', label: 'SMS', count: counts.sms },
            { value: 'push', label: 'Push', count: counts.push },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Search number or text" />
      </div>
      <DataTable
        query={query}
        rows={filtered}
        columns={columns}
        emptyIcon="message"
        emptyTitle={query.data?.length ? 'No messages match these filters' : 'Nothing sent yet'}
      />
    </>
  );
}

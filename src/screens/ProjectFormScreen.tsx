import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { PeoplePicker } from '../components/PeoplePicker';
import {
  Chip,
  Field,
  PrimaryButton,
  Screen,
  Subtitle,
  Title,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { RootStackParamList } from '../navigation/types';
import { projectStatusColor } from '../theme/status';
import { ProjectStatus } from '../types/models';

const STATUSES: ProjectStatus[] = [
  'Potential',
  'In Progress',
  'On Hold',
  'In Testing',
  'Completed',
];

export function ProjectFormScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ProjectForm'>>();
  const navigation = useNavigation();
  const { data, saveProject } = useData();
  const { user } = useAuth();
  const existing = route.params?.project;
  const linked = data.project_contributors
    .filter((row) => row.project_id === existing?.project_id && row.active_status !== 'inactive')
    .map((row) => row.contributor_id);
  const billing = data.project_billing.find((row) => row.project_id === existing?.project_id);

  const [client_name, setClientName] = useState(existing?.client_name || '');
  const [project_type, setProjectType] = useState(existing?.project_type || '');
  const [status, setStatus] = useState<ProjectStatus>(
    existing?.status || 'Potential',
  );
  const [phone, setPhone] = useState(existing?.phone || '');
  const [email, setEmail] = useState(existing?.email || '');
  const [address, setAddress] = useState(existing?.address || '');
  const [people, setPeople] = useState<string[]>(
    linked.length ? linked : user?.contributor_id ? [user.contributor_id] : [],
  );
  const [gst, setGst] = useState<'yes' | 'no'>(billing?.gst_included === 'no' ? 'no' : 'yes');
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    if (busy) return;
    if (!client_name.trim()) {
      Alert.alert('Client name required');
      return;
    }
    if (!people.length) {
      Alert.alert('Choose at least one person');
      return;
    }
    try {
      setBusy(true);
      await saveProject({
        ...existing,
        client_name: client_name.trim(),
        project_type,
        status,
        phone,
        email,
        address,
        contributorIds: people,
        gstIncluded: gst,
        completed_date:
          status === 'Completed'
            ? existing?.completed_date || new Date().toISOString().slice(0, 10)
            : existing?.completed_date || '',
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Title>{existing ? 'Edit project' : 'New project'}</Title>
      <Subtitle>Updates notify everyone</Subtitle>
      <Field label="Client name" icon="person-outline" value={client_name} onChangeText={setClientName} />
      <Field label="Project type" icon="pricetag-outline" value={project_type} onChangeText={setProjectType} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        {STATUSES.map((s) => (
          <Chip
            key={s}
            label={s}
            color={projectStatusColor(s)}
            active={status === s}
            onPress={() => setStatus(s)}
          />
        ))}
      </View>
      <Field label="Phone" icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Email" icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Address" icon="location-outline" value={address} onChangeText={setAddress} multiline />
      <PeoplePicker label="People on this project" selected={people} onChange={setPeople} />
      <Subtitle>GST is included in the bill. The team splits the amount after tax.</Subtitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        <Chip label="GST yes" active={gst === 'yes'} onPress={() => setGst('yes')} />
        <Chip label="GST no" active={gst === 'no'} onPress={() => setGst('no')} />
      </View>
      <PrimaryButton icon="save-outline" label={busy ? 'Saving…' : 'Save'} onPress={onSave} loading={busy} />
    </Screen>
  );
}

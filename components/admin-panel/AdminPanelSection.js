import React from 'react';
import PropTypes from 'prop-types';
import { values } from 'lodash';
import { useIntl } from 'react-intl';
import styled from 'styled-components';

import Container from '../Container';
import { Box } from '../Grid';
import HostDashboardExpenses from '../host-dashboard/HostDashboardExpenses';
import HostDashboardHostedCollectives from '../host-dashboard/HostDashboardHostedCollectives';
import PendingApplications from '../host-dashboard/PendingApplications';
import LoadingPlaceholder from '../LoadingPlaceholder';
import NotFound from '../NotFound';

import AccountSettings from './sections/AccountSettings';
import FinancialContributions from './sections/FinancialContributions';
import {
  HOST_DASHBOARD_SECTIONS,
  LEGACY_COLLECTIVE_SETTINGS_SECTIONS,
  ORG_BUDGET_SECTIONS,
  SECTION_LABELS,
} from './constants';

const HOST_ADMIN_SECTIONS = {
  [HOST_DASHBOARD_SECTIONS.HOSTED_COLLECTIVES]: HostDashboardHostedCollectives,
  [HOST_DASHBOARD_SECTIONS.FINANCIAL_CONTRIBUTIONS]: FinancialContributions,
  [HOST_DASHBOARD_SECTIONS.EXPENSES]: HostDashboardExpenses,
  [HOST_DASHBOARD_SECTIONS.PENDING_APPLICATIONS]: PendingApplications,
};

const Title = styled(Box)`
  font-size: 24px;
  font-weight: 700;
  line-height: 32px;
`;

// Some sections include their own title
const IGNORED_SECTION_TITLES = [ORG_BUDGET_SECTIONS.PENDING_ORDERS];

const AdminPanelSection = ({ collective, isLoading, section }) => {
  const { formatMessage } = useIntl();

  if (isLoading) {
    return (
      <div>
        <LoadingPlaceholder height={26} mb={4} maxWidth={500} />
        <LoadingPlaceholder height={300} />
      </div>
    );
  }

  // Host Dashboard
  const AdminSectionComponent = HOST_ADMIN_SECTIONS[section];
  if (AdminSectionComponent) {
    return (
      <Container width="100%">
        <AdminSectionComponent hostSlug={collective.slug} isNewAdmin />
      </Container>
    );
  }

  // Form
  if (values(LEGACY_COLLECTIVE_SETTINGS_SECTIONS).includes(section)) {
    return (
      <Container width="100%">
        {SECTION_LABELS[section] && !IGNORED_SECTION_TITLES.includes(section) && (
          <Box mb={3}>
            <Title>{formatMessage(SECTION_LABELS[section])}</Title>
          </Box>
        )}
        <AccountSettings account={collective} />
      </Container>
    );
  }

  return (
    <Container display="flex" justifyContent="center" alignItems="center">
      <NotFound />
    </Container>
  );
};

AdminPanelSection.propTypes = {
  isLoading: PropTypes.bool,
  section: PropTypes.string,
  /** The account. Can be null if isLoading is true */
  collective: PropTypes.shape({
    slug: PropTypes.string.isRequired,
    name: PropTypes.string,
    isHost: PropTypes.bool,
  }),
};

export default AdminPanelSection;

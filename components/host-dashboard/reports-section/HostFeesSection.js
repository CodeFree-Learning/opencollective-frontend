import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@apollo/client';
import { ChevronDown } from '@styled-icons/fa-solid/ChevronDown/ChevronDown';
import { ChevronUp } from '@styled-icons/fa-solid/ChevronUp/ChevronUp';
import dynamic from 'next/dynamic';
import { FormattedMessage, useIntl } from 'react-intl';
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

import { get, groupBy } from 'lodash';
import styled from 'styled-components';

import { CollectiveType } from '../../../lib/constants/collectives';
import { formatCurrency } from '../../../lib/currency-utils';
import { API_V2_CONTEXT, gqlV2 } from '../../../lib/graphql/helpers';
import { i18nTransactionSettlementStatus } from '../../../lib/i18n/transaction';

import PeriodFilter, { encodePeriod, parseDateRange } from '../../budget/filters/PeriodFilter';
import CollectivePickerAsync from '../../CollectivePickerAsync';
import Container from '../../Container';
import ContainerOverlay from '../../ContainerOverlay';
import { Box, Flex } from '../../Grid';
import Image from '../../Image';
import Loading from '../../Loading';
import StyledCard from '../../StyledCard';
import StyledLinkButton from '../../StyledLinkButton';
import { StyledSelectFilter } from '../../StyledSelectFilter';
import StyledSpinner from '../../StyledSpinner';
import { P, Span } from '../../Text';

const mainReportsQuery = gqlV2/* GraphQL */ `
  query ReportsPageQuery($hostSlug: String!, $dateFrom: DateTime!, $dateTo: DateTime!) {
    host(slug: $hostSlug) {
      id
      createdAt
      currency
      hostMetricsTimeSeries(dateFrom: $dateFrom, dateTo: $dateTo, timeUnit: MONTH) {
        hostFees {
          nodes {
            date
            amount {
              value
              valueInCents
              currency
            }
          }
        }
        hostFeeShare {
          nodes {
            date
            settlementStatus
            amount {
              value
              valueInCents
              currency
            }
          }
        }
      }
    }
  }
`;

const ChartWrapper = styled.div`
  position: relative;

  .apexcharts-legend-series {
    background: white;
    padding: 8px;
    border-radius: 10px;
    & > span {
      vertical-align: middle;
    }
  }

  .apexcharts-legend-marker {
    margin-right: 8px;
  }
`;

const FilterLabel = styled.label`
  font-weight: 500;
  text-transform: uppercase;
  margin-bottom: 8px;
  color: #4e5052;
`;

const getChartOptions = (intl, hostCurrency) => ({
  chart: {
    id: 'chart-host-report-fees',
    stacked: true,
  },
  legend: {
    show: true,
    showForSingleSeries: true,
    horizontalAlign: 'left',
    fontWeight: 'bold',
    fontSize: '12px',
    markers: {
      width: 16,
      height: 16,
    },
  },
  dataLabels: { enabled: false },
  grid: {
    raw: { opacity: 0 },
    column: { opacity: 0 },
    xaxis: { lines: { show: true } },
    yaxis: { lines: { show: false } },
  },
  plotOptions: {
    bar: {
      columnWidth: '50%',
    },
  },
  colors: ['#46347F', '#95DDF4', '#F5C451', '#0EA755'], // TODO(HostReport): Use host primary colors
  xaxis: {
    categories: [...new Array(12)].map(
      (_, idx) => `${intl.formatDate(new Date(0, idx), { month: 'short' }).toUpperCase()}`,
    ),
  },
  yaxis: {
    labels: {
      minWidth: 38,
      formatter: function (value) {
        return value < 1000 ? value : `${Math.round(value / 1000)}k`;
      },
    },
  },
  tooltip: {
    y: {
      formatter: function (value) {
        return formatCurrency(value * 100, hostCurrency);
      },
    },
  },
});

const getHostFeesWithoutShare = (hostFeeNodes, hostFeeShareNodes) => {
  const totalHostFeeSharePerMonthInCents = hostFeeShareNodes.reduce((result, node) => {
    const monthKey = new Date(node.date).getMonth();
    result[monthKey] = (result[monthKey] || 0) + node.amount.valueInCents;
    return result;
  }, {});

  return hostFeeNodes.map(node => {
    const monthKey = new Date(node.date).getMonth();
    if (totalHostFeeSharePerMonthInCents[monthKey]) {
      const valueInCents = node.amount.valueInCents - totalHostFeeSharePerMonthInCents[monthKey];
      return { ...node, amount: { ...node.amount, valueInCents, value: valueInCents / 100 } };
    } else {
      return node;
    }
  });
};

const getSeriesFromData = (intl, timeSeries) => {
  const dataToSeries = data => {
    const series = new Array(12).fill(0); // = 12 months
    data?.forEach(({ date, amount }) => (series[new Date(date).getMonth()] = amount.value));
    return series;
  };

  const hostFeeNodes = get(timeSeries, 'hostFees.nodes', []);
  const hostFeeShareNodes = get(timeSeries, 'hostFeeShare.nodes', []);
  // TODO(HostReport): I18n the series names
  return [
    { name: 'Host profit', data: dataToSeries(getHostFeesWithoutShare(hostFeeNodes, hostFeeShareNodes)) },
    ...Object.entries(groupBy(hostFeeShareNodes, 'settlementStatus')).map(([status, nodes]) => ({
      name: `Host fee share (${i18nTransactionSettlementStatus(intl, status)})`,
      data: dataToSeries(nodes),
    })),
  ];
};

const getActiveYearsOptions = host => {
  const currentYear = new Date().getFullYear();
  const firstYear = host ? parseInt(host.createdAt.split('-')[0]) : currentYear;
  const activeYears = [...Array(currentYear - firstYear + 1).keys()].map(year => year + firstYear);
  return activeYears.map(year => ({ value: year, label: year }));
};

const getQueryVariables = (hostSlug, year) => {
  return {
    hostSlug,
    dateFrom: `${year}-01-01T00:00:00Z`,
    dateTo: `${year}-12-31T23:59:59Z`,
  };
};

const HostFeesSection = ({ hostSlug }) => {
  const intl = useIntl();
  const [selectedYear, setSelectedYear] = React.useState(() => new Date().getFullYear());
  const variables = getQueryVariables(hostSlug, selectedYear);
  const { loading, data, previousData } = useQuery(mainReportsQuery, { variables, context: API_V2_CONTEXT });
  const host = loading && !data ? previousData?.host : data?.host;
  const timeSeries = host?.hostMetricsTimeSeries;
  const series = React.useMemo(() => getSeriesFromData(intl, timeSeries), [timeSeries]);
  const yearsOptions = React.useMemo(() => getActiveYearsOptions(host), [host]);
  const chartOptions = React.useMemo(() => getChartOptions(intl, host?.currency), [host?.currency]);
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [collectives, setCollectives] = useState(null);
  const [showHostFeeChart, setShowHostFeeChart] = useState(true);

  if (loading && !host) {
    return <Loading />;
  }

  const setDate = period => {
    const { from, to } = parseDateRange(period);
    setDateFrom(from || null);
    setDateTo(to || null);
  };

  const setCollectiveFilter = collectives => {
    if (collectives.length === 0) {
      setCollectives(null);
    } else {
      const collectiveIds = collectives.map(collective => ({ legacyId: collective.value.id }));
      setCollectives(collectiveIds);
    }
  };

  return (
    <React.Fragment>
      <Flex flexWrap="wrap" mt="16px" mb="16px">
        <Container width={[1, 1, 1 / 2]} pr={2} mb={[3, 3, 0, 0]}>
          <FilterLabel htmlFor="transactions-period-filter">
            <FormattedMessage id="TransactionsOverviewSection.PeriodFilter" defaultMessage="Filter by Date" />
          </FilterLabel>
          <PeriodFilter
            onChange={value => setDate(value)}
            value={encodePeriod({ dateInterval: { from: dateFrom, to: dateTo } })}
          />
        </Container>
        <Container width={[1, 1, 1 / 2]}>
          <FilterLabel htmlFor="transactions-collective-filter">
            <FormattedMessage id="TransactionsOverviewSection.CollectiveFilter" defaultMessage="Filter by Collective" />
          </FilterLabel>
          <CollectivePickerAsync
            inputId="TransactionsCollectiveFilter"
            data-cy="transactions-collective-filter"
            types={[CollectiveType.COLLECTIVE, CollectiveType.EVENT, CollectiveType.PROJECT]}
            isMulti
            hostCollectiveIds={[host?.legacyId]}
            onChange={value => setCollectiveFilter(value)}
          />
        </Container>
      </Flex>
      <StyledCard minHeight={200} px={3} css={{ background: '#F6F5FF' }}>
        <Flex flexWrap="wrap">
          <Container width={[1, 1, '230px']} px={2}>
            <P fontSize="12px" fontWeight="500" textTransform="uppercase" mt="24px">
              <Span mr={10}>
                <Image width={14} height={7} src="/static/images/host-fees-timeline.svg" />
              </Span>
              <FormattedMessage defaultMessage="Total Host Fees" />
            </P>
            <P fontSize="12px" fontWeight="400" mt="10px">
              <FormattedMessage defaultMessage="Host Fees charged each month, which will be added to the Host budget at the end of the month." />
            </P>
          </Container>
          <Container display={['none', 'none', 'flex']} borderLeft="1px solid #6B5D99" height="88px" mt="39px" />
          <Container width={[1, 1, '230px']} px={2}>
            <P fontSize="12px" fontWeight="500" textTransform="uppercase" mt="24px">
              <Span mr={10}>
                <Image width={6.5} height={12} mr={10} src="/static/images/host-fees-money-sign.svg" />
              </Span>
              <FormattedMessage defaultMessage="Your Profit" />
            </P>
            <P fontSize="12px" fontWeight="400" mt="10px">
              <FormattedMessage defaultMessage="The profit as an organization resulting of the host fees you collect without the shared revenue for the use of the platform." />
            </P>
          </Container>
          <Container display={['none', 'none', 'flex']} borderLeft="1px solid #6B5D99" height="88px" mt="39px" />
          <Container width={[1, 1, '230px']} px={2}>
            <P fontSize="12px" fontWeight="500" textTransform="uppercase" mt="24px">
              <Span mr={10}>
                <Image width={9.42} height={12} mr={10} src="/static/images/host-fees-oc.svg" />
              </Span>
              <FormattedMessage defaultMessage="Shared Revenue" />
            </P>
            <P fontSize="12px" fontWeight="400" mt="10px">
              <FormattedMessage defaultMessage="The cost of using the platform. It is collected each month with a settlement invoice uploaded to you as an expense." />
            </P>
          </Container>
        </Flex>
        <Flex flexWrap="wrap">
          <Container width={[1, 1, 3 / 4]} px={2}>
            <P fontSize="12px" fontWeight="400" mt="16px">
              <FormattedMessage defaultMessage="How is you organization's doing using Open Collective?" />
            </P>
          </Container>
          <Container width={[1, 1, 1 / 4]} px={2} textAlign="right">
            <StyledLinkButton asLink onClick={() => setShowHostFeeChart(!showHostFeeChart)}>
              <P fontSize="12px" fontWeight="400" mt="16px">
                <FormattedMessage defaultMessage="See historical" />
                <Span pl="8px">
                  {showHostFeeChart ? (
                    <ChevronUp size={12} color="#46347F" />
                  ) : (
                    <ChevronDown fontVariant="solid" size={12} color="#46347F" />
                  )}
                </Span>
              </P>
            </StyledLinkButton>
          </Container>
        </Flex>
        {showHostFeeChart && (
          <Box py={3}>
            <Flex alignItems="center" px={2} mb={2}>
              <P fontSize="11px" fontWeight="700" mr={3} textTransform="uppercase">
                <FormattedMessage id="HostFeesSection.Title" defaultMessage="Collected host fees per year" />
              </P>
              <StyledSelectFilter
                inputId="host-report-host-fees-year-select"
                options={yearsOptions}
                defaultValue={{ value: selectedYear, label: selectedYear }}
                onChange={({ value }) => setSelectedYear(value)}
                isSearchable={false}
                minWidth={100}
              />
            </Flex>
            <ChartWrapper>
              {loading && (
                <ContainerOverlay>
                  <StyledSpinner size={64} />
                </ContainerOverlay>
              )}
              <Chart type="bar" width="100%" height="250px" options={chartOptions} series={series} />
            </ChartWrapper>
          </Box>
        )}
      </StyledCard>
    </React.Fragment>
  );
};

HostFeesSection.propTypes = {
  hostSlug: PropTypes.string.isRequired,
};

export default HostFeesSection;

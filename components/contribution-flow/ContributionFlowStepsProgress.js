import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import styled from 'styled-components';

import INTERVALS from '../../lib/constants/intervals';
import { getPaymentMethodName } from '../../lib/payment_method_label';

import Container from '../Container';
import FormattedMoneyAmount from '../FormattedMoneyAmount';
import { Flex } from '../Grid';
import StepsProgress from '../StepsProgress';
import { P, Span } from '../Text';

import { STEPS } from './constants';
import { getTotalAmount } from './utils';

// Styles for the steps label rendered in StepsProgress
const StepLabel = styled(Span)`
  text-transform: uppercase;
  text-align: center;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  letter-spacing: 0.06em;
  margin-top: 8px;
  margin-bottom: 4px;
`;

const PrettyAmountFromStepDetails = ({ stepDetails, currency, isFreeTier, isCrypto }) => {
  if (stepDetails.amount) {
    const totalAmount = stepDetails.amount + (stepDetails.platformContribution || 0);
    return (
      <FormattedMoneyAmount
        interval={stepDetails.interval !== INTERVALS.flexible ? stepDetails.interval : null}
        currency={currency}
        amount={totalAmount}
        abbreviateInterval
        amountStyles={null}
        isCrypto={isCrypto}
      />
    );
  } else if (stepDetails.amount === 0 && isFreeTier) {
    return <FormattedMessage id="Amount.Free" defaultMessage="Free" />;
  } else {
    return null;
  }
};

const StepInfo = ({ step, stepProfile, stepDetails, stepPayment, stepSummary, isFreeTier, currency, isCrypto }) => {
  if (step.name === STEPS.PROFILE) {
    if (stepProfile) {
      const mainInfo = (stepProfile.id && stepProfile.name) || (stepProfile.email ?? stepProfile.name);
      const fullDescription = [stepProfile.name, stepProfile.email].filter(Boolean).join(' · ');
      return (
        <P title={fullDescription} fontSize="inherit" lineHeight="inherit" truncateOverflow css={{ maxWidth: 150 }}>
          {mainInfo}
        </P>
      );
    }
  } else if (step.name === STEPS.DETAILS) {
    if (stepDetails) {
      return (
        <React.Fragment>
          <PrettyAmountFromStepDetails
            stepDetails={stepDetails}
            currency={currency}
            isFreeTier={isFreeTier}
            isCrypto={isCrypto}
          />
          {!isNaN(stepDetails.quantity) && stepDetails.quantity > 1 && ` x ${stepDetails.quantity}`}
        </React.Fragment>
      );
    }
  } else if (step.name === STEPS.PAYMENT) {
    if (isFreeTier && getTotalAmount(stepDetails, stepSummary) === 0) {
      return <FormattedMessage id="noPaymentRequired" defaultMessage="No payment required" />;
    } else {
      return (!isCrypto && stepPayment?.paymentMethod && getPaymentMethodName(stepPayment.paymentMethod)) || null;
    }
  } else if (step.name === STEPS.SUMMARY) {
    return stepSummary?.countryISO || null;
  }

  return null;
};

StepInfo.propTypes = {
  step: PropTypes.object,
  stepProfile: PropTypes.object,
  stepDetails: PropTypes.object,
  stepPayment: PropTypes.object,
  stepSummary: PropTypes.object,
  isFreeTier: PropTypes.bool,
  currency: PropTypes.string,
  isCrypto: PropTypes.bool,
};

const ContributionFlowStepsProgress = ({
  stepProfile,
  stepDetails,
  stepPayment,
  stepSummary,
  isSubmitted,
  loading,
  steps,
  currentStep,
  lastVisitedStep,
  goToStep,
  currency,
  isFreeTier,
  isCrypto,
}) => {
  return (
    <StepsProgress
      steps={steps}
      focus={currentStep}
      allCompleted={isSubmitted}
      onStepSelect={!loading && !isSubmitted ? goToStep : undefined}
      loadingStep={loading ? currentStep : undefined}
      disabledStepNames={steps.slice(lastVisitedStep.index + 1, steps.length).map(s => s.name)}
    >
      {({ step }) => (
        <Flex flexDirection="column" alignItems="center">
          <StepLabel color={currentStep.name === step.name ? 'primary.600' : 'black.700'}>
            {step.label || step.name}
          </StepLabel>
          <Container fontSize="13px" lineHeight="20px" textAlign="center" wordBreak="break-word">
            {step.isVisited && (
              <StepInfo
                step={step}
                stepProfile={stepProfile}
                stepDetails={stepDetails}
                stepPayment={stepPayment}
                stepSummary={stepSummary}
                isFreeTier={isFreeTier}
                currency={currency}
                isCrypto={isCrypto}
              />
            )}
          </Container>
        </Flex>
      )}
    </StepsProgress>
  );
};

ContributionFlowStepsProgress.propTypes = {
  steps: PropTypes.arrayOf(PropTypes.object).isRequired,
  currentStep: PropTypes.object.isRequired,
  goToStep: PropTypes.func.isRequired,
  stepProfile: PropTypes.object,
  stepDetails: PropTypes.object,
  stepPayment: PropTypes.object,
  stepSummary: PropTypes.object,
  isSubmitted: PropTypes.bool,
  loading: PropTypes.bool,
  lastVisitedStep: PropTypes.object,
  currency: PropTypes.string,
  isFreeTier: PropTypes.bool,
  isCrypto: PropTypes.bool,
};

export default ContributionFlowStepsProgress;

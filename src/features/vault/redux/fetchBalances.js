import { useCallback } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import {
  VAULT_FETCH_BALANCES_BEGIN,
  VAULT_FETCH_BALANCES_SUCCESS,
  VAULT_FETCH_BALANCES_FAILURE,
  VAULT_FETCH_BALANCES_DISMISS_ERROR,
} from './constants';
import { fetchBalance } from "../../web3";
import Web3 from 'web3';
import async from 'async';

export function fetchBalances(data) {
  return dispatch => {
    // optionally you can have getState as the second argument
    dispatch({
      type: VAULT_FETCH_BALANCES_BEGIN,
    });

    // Return a promise so that you could control UI flow without states in the store.
    // For example: after submit a form, you need to redirect the page to another when succeeds or show some errors message if fails.
    // It's hard to use state to manage it, but returning a promise allows you to easily achieve it.
    // e.g.: handleSubmit() { this.props.actions.submitForm(data).then(()=> {}).catch(() => {}); }
    const promise = new Promise((resolve, reject) => {
      // doRequest is a placeholder Promise. You should replace it with your own logic.
      // See the real-word example at:  https://github.com/supnate/rekit/blob/master/src/features/vault/redux/fetchRedditReactjsList.js
      // args.error here is only for test coverage purpose.
      const { account, provider, tokens } = data;
      const web3 = new Web3(provider);

      const newTokens = [];
      for (let key in tokens) {
        newTokens.push({
          token: key,
          tokenDecimals: tokens[key].tokenDecimals,
          tokenAddress: tokens[key].tokenAddress,
          tokenBalance: tokens[key].tokenBalance,
        });
      }
      async.map(newTokens, (token, callback) => {
        async.parallel([
          (callbackInner) => { 
            fetchBalance({
              web3,
              tokenAddress: token.tokenAddress,
              tokenDecimals: token.tokenDecimals,
              account
            }).then(
              data => callbackInner(null, data)
            ).catch(
              error => callbackInner(error.message || error)
            )
          }
        ], (error, data) => {
          token.tokenBalance = data[0] || 0
          callback(null, token)
        })
      }, (error, tokens) => {
        if(error) {
          console.log(error)
          dispatch({
            type: VAULT_FETCH_BALANCES_FAILURE,
            data: error.message || error,
          })
          return reject()
        }
        const newTokens = {};
        for(let i = 0; i < tokens.length; i++) {
          newTokens[tokens[i].token] = {
            tokenDecimals: tokens[i].tokenDecimals,
            tokenAddress: tokens[i].tokenAddress,
            tokenBalance: tokens[i].tokenBalance
          }
        }
        dispatch({
          type: VAULT_FETCH_BALANCES_SUCCESS,
          data: newTokens,
        })
        resolve()
      })
    });

    return promise;
  };
}

// Async action saves request error by default, this method is used to dismiss the error info.
// If you don't want errors to be saved in Redux store, just ignore this method.
export function dismissFetchBalancesError() {
  return {
    type: VAULT_FETCH_BALANCES_DISMISS_ERROR,
  };
}

export function useFetchBalances() {
  // args: false value or array
  // if array, means args passed to the action creator
  const dispatch = useDispatch();

  const { tokens, fetchBalancesPending, fetchBalancesError } = useSelector(
    state => ({
      tokens: state.vault.tokens,
      fetchBalancesPending: state.vault.fetchBalancesPending,
      fetchBalancesError: state.vault.fetchBalancesError,
    }),
    shallowEqual,
  );

  const boundAction = useCallback(
    (data) => {
      dispatch(fetchBalances(data));
    },
    [dispatch],
  );

  const boundDismissFetchBalancesError = useCallback(() => {
    dispatch(dismissFetchBalancesError());
  }, [dispatch]);

  return {
    tokens,
    fetchBalances: boundAction,
    fetchBalancesPending,
    fetchBalancesError,
    dismissFetchBalancesError: boundDismissFetchBalancesError,
  };
}

export function reducer(state, action) {
  switch (action.type) {
    case VAULT_FETCH_BALANCES_BEGIN:
      // Just after a request is sent
      return {
        ...state,
        fetchBalancesPending: true,
        fetchBalancesError: null,
      };

    case VAULT_FETCH_BALANCES_SUCCESS:
      // The request is success
      return {
        ...state,
        tokens: action.data,
        fetchBalancesPending: false,
        fetchBalancesError: null,
      };

    case VAULT_FETCH_BALANCES_FAILURE:
      // The request is failed
      return {
        ...state,
        fetchBalancesPending: false,
        fetchBalancesError: action.data.error,
      };

    case VAULT_FETCH_BALANCES_DISMISS_ERROR:
      // Dismiss the request failure error
      return {
        ...state,
        fetchBalancesError: null,
      };

    default:
      return state;
  }
}
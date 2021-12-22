//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.


import { useEffect, FC, createElement, useState } from 'react';
import { getCurrentPoolUser, callAPI } from 'douhub-ui-web';

import { isFunction, isNil, isEmpty } from 'lodash';
import { isNonEmptyString, isObject, _window } from 'douhub-helper-util';

export const initClient = async (solution: Record<string, any>) => {

    if (!isObject(_window.syncClient)) {
        console.log('realtime.syncClient.start');

        //get the current cognito user
        const poolUser = await getCurrentPoolUser(solution);

        //only a valid cognito user can do realtime messaging
        if (!isEmpty(poolUser)) {
            _window.syncClient = {};
            //get realtime token
            const r = await callAPI(solution, `${solution.apiEndpoint.realtime}token`, {}, 'GET');
            if (isNil(_window._twilioSync)) _window._twilioSync = await import('twilio-sync');

            _window.syncClient = new _window._twilioSync.SyncClient(r.token);

            _window.syncClient.on('tokenAboutToExpire', function () {
                (async () => {
                    //get new realtime token
                    const r = await callAPI(solution, `${solution.apiEndpoint.realtime}token`, {}, 'GET');
                    _window.syncClient.updateToken(r.token);
                })();
            });

            _window.syncClient.on('tokenExpired', function () {
                (async () => {
                    //get new realtime token
                    const r = await callAPI(solution, `${solution.apiEndpoint.realtime}token`, {}, 'GET');
                    _window.syncClient.updateToken(r.token);
                })();
            });

            _window.syncClient.subscriptions = {};
            console.log('realtime.syncClient.success');
        }
    }
}

export const createList = async (solution: Record<string, any>, data: Record<string, any>, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apiEndpoint.realtime}create-list`, { ...settings, data }, 'POST');
}

export const upsertList = async (solution: Record<string, any>, data: Record<string, any>, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apiEndpoint.realtime}update-list`, { ...settings, data }, 'PUT');
}

export const updateList = async (solution: Record<string, any>, data: Record<string, any>, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apiEndpoint.realtime}update-list`, { ...settings, data }, 'PUT');
}

export const deleteList = async (solution: Record<string, any>, id: string, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apiEndpoint.realtime}delete-list`, { ...settings, id }, 'DELETE');
}

export const createListItem = async (solution: Record<string, any>, data: Record<string, any>, settings: Record<string, any>) => {
   await callAPI(solution, `${solution.apiEndpoint.realtime}create-list-item`, { ...settings, data }, 'POST');
}

export const deleteListItem = async (solution: Record<string, any>, data: Record<string, any>, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apiEndpoint.realtime}delete-list-item`, { ...settings, data }, 'DELETE');
}

export const createDocument = async (solution: Record<string, any>, data: Record<string, any>, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apiEndpoint.realtime}create-document`, { ...settings, data }, 'POST');
}

export const upsertDocument = async (solution: Record<string, any>, data: Record<string, any>, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apiEndpoint.realtime}upsert-document`, { ...settings, data }, 'PUT');
}

export const updateDocument = async (solution: Record<string, any>, data: Record<string, any>, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apiEndpoint.realtime}update-document`, { ...settings, data }, 'PUT');
}

export const deleteDocument = async (solution: Record<string, any>, id: string, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apiEndpoint.realtime}delete-document`, { ...settings, id }, 'DELETE');
}

export const subscribeSyncClient = async (type: 'Document' | 'List', syncId: string, onEvent: any) => {
    const cacheKey = `${type}-${syncId}`;

    if (isObject(_window.syncClient) &&
        !isEmpty(_window.syncClient) &&
        isObject(_window.syncClient.subscriptions) &&
        !_window.syncClient.subscriptions[cacheKey]) {

        console.log('realtime.subscribeSyncClient.start', type, syncId);

        return new Promise((resolve, reject) => {
            _window.syncClient[type.toLowerCase()](syncId)
                .then((result: any) => {

                    _window.syncClient.subscriptions[cacheKey] = new Date();
                    console.log('realtime.subscribeSyncClient.success', syncId);

                    result.on('updated', function (event: any) {
                        onEvent({ type: 'DOC_UPDATED', data: event.data });
                    });
                    result.on('itemAdded', function (args: Record<string, any>) {
                        onEvent({ type: 'ITEM_ADDED', data: args.item });
                    });
                    result.on('itemRemoved', function (args: Record<string, any>) {
                        onEvent({ type: 'ITEM_REMOVED', data: args.item });
                    });
                    result.on('itemUpdated', function (args: Record<string, any>) {
                        onEvent({ type: 'ITEM_UPDATED', data: args.item });
                    });

                    resolve(result);
                })
                .catch((error: any) => {
                    console.log('realtime.subscribeSyncClient.failed', type, syncId, error);
                    reject(error);
                });
        });
    }
    else {
        console.log('realtime.subscribeSyncClient.false', type, syncId);
        return null;
    }
}

export const Realtime: FC<{
    type: 'Document' | 'List',
    syncId: string,
    hideErrorMessage: false,
    solution: Record<string, any>,
    onEvent: (message: Record<string, any>) => any,
    onError?: (message: Record<string, any>, error:any) => any
}> = (props) => {

    const { syncId, solution, type, hideErrorMessage } = props;
    const [error, setError] = useState<string>('');


    const onEvent = (document: Record<string, any>) => {
        if (isFunction(props.onEvent)) props.onEvent(document);
    }

    const onError = (message: string, error: any) => {
        if (isFunction(props.onError)) {
            props.onError(document, error);
        }
        else {
            if (hideErrorMessage) setError(message);
        }
    }

    useEffect(() => {
        (async () => {
            try {
                await initClient(solution);
                if (isNonEmptyString(syncId)) await subscribeSyncClient(type, syncId, onEvent);
            }
            catch (error: any) {
                console.error(error);
                const message = `Failed to initialize the realtime comminication (${error?.statusMessage}).`;
                onError(message, error);
            }
        })();
    }, [_window._auth, syncId])

    return createElement('div', { className: 'text-red-500 text-xs' }, error);
};
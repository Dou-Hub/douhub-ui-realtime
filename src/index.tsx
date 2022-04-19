//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.


import { useEffect, useState } from 'react';
import { getCurrentPoolUser, callAPI, _window, _track } from 'douhub-ui-web-basic';
import { isFunction, isNil, isEmpty, isNumber } from 'lodash';
import { isNonEmptyString, isObject } from 'douhub-helper-util';

export const retrieveList = async (solution: Record<string, any>, id: string, settings?: Record<string, any>) => {
    return await callAPI(solution, `${solution.apis.realtime}retrieve-list`, { ...settings, id }, 'GET');
}

export const createList = async (solution: Record<string, any>, data: Record<string, any>, settings?: Record<string, any>) => {
    return await callAPI(solution, `${solution.apis.realtime}create-list`, { ...settings, data }, 'POST');
}

export const upsertList = async (solution: Record<string, any>, data: Record<string, any>, settings?: Record<string, any>) => {
    return await callAPI(solution, `${solution.apis.realtime}update-list`, { ...settings, data }, 'PUT');
}

export const updateList = async (solution: Record<string, any>, data: Record<string, any>, settings?: Record<string, any>) => {
    return await callAPI(solution, `${solution.apis.realtime}update-list`, { ...settings, data }, 'PUT');
}

export const deleteList = async (solution: Record<string, any>, id: string, settings?: Record<string, any>) => {
    return await callAPI(solution, `${solution.apis.realtime}delete-list`, { ...settings, id }, 'DELETE');
}

export const retrieveListItem = async (solution: Record<string, any>, id: string, index: number, settings?: Record<string, any>) => {
    return await callAPI(solution, `${solution.apis.realtime}retrieve-list-item`, { ...settings, id, index }, 'GET');
}

export const retrieveListItems = async (solution: Record<string, any>, id: string, settings?: Record<string, any>) => {
    return await callAPI(solution, `${solution.apis.realtime}retrieve-list-items`, { ...settings, id }, 'GET');
}

export const createListItem = async (solution: Record<string, any>, data: Record<string, any>, settings?: Record<string, any>) => {
    return await callAPI(solution, `${solution.apis.realtime}create-list-item`, { ...settings, data }, 'POST');
}

export const deleteListItem = async (solution: Record<string, any>, id: string, index: number, settings?: Record<string, any>) => {
    return await callAPI(solution, `${solution.apis.realtime}delete-list-item`, { ...settings, id, index }, 'DELETE');
}

export const createDocument = async (solution: Record<string, any>, data: Record<string, any>, settings?: Record<string, any>) => {
    return await callAPI(solution, `${solution.apis.realtime}create-document`, { ...settings, data }, 'POST');
}

export const upsertDocument = async (solution: Record<string, any>, data: Record<string, any>, settings?: Record<string, any>) => {
    return await callAPI(solution, `${solution.apis.realtime}upsert-document`, { ...settings, data }, 'PUT');
}

export const updateDocument = async (solution: Record<string, any>, data: Record<string, any>, settings?: Record<string, any>) => {
    return await callAPI(solution, `${solution.apis.realtime}update-document`, { ...settings, data }, 'PUT');
}

export const deleteDocument = async (solution: Record<string, any>, id: string, settings?: Record<string, any>) => {
    return await callAPI(solution, `${solution.apis.realtime}delete-document`, { ...settings, id }, 'DELETE');
}


export const currentRealtimeNetwork = (
    onSuccess?: any,
    onError?: any,
    settings?: {
        retryCount?: number,
        apiEndpoint?: string,
        solution?: Record<string, any>
    }
): boolean => {

    const solution = settings?.solution ? settings?.solution : _window.solution;
    const [connected, setConnected] = useState<boolean>(false);
    const [retry, setRetry] = useState(0);
    const [error, setError] = useState(null);

    settings = isObject(settings) ? settings : {};
    const retryCount = settings && isNumber(settings?.retryCount) && settings?.retryCount > 0 ? settings.retryCount : 5;
    const apiEndpoint = settings && isNonEmptyString(settings?.apiEndpoint) ? settings?.apiEndpoint : solution.apis.realtime;

    const isGoodNetwork = () => {
        return isObject(_window?.realtimeNetwork?.subscriptions);
    }

    useEffect(() => {
        (async () => {
            if (isNil(_window.realtimeNetwork) && isObject(solution)) {

                _window.realtimeNetwork = {}; //this make sure the same useEffect run too many times 

                if (_track) console.log('realtime.syncClient.start', { retry });

                try {
                    //get the current cognito user
                    const poolUser = await getCurrentPoolUser(solution);

                    //only a valid cognito user can do realtime messaging
                    if (!isEmpty(poolUser)) {

                        //get realtime token
                        const r = await callAPI(solution, `${apiEndpoint}token`, {}, 'GET');
                        if (isNil(_window._twilioSync)) _window._twilioSync = await import('twilio-sync');

                        _window.realtimeNetwork = new _window._twilioSync.SyncClient(r.token);

                        if (_track) console.log({ token: r.token });

                        _window.realtimeNetwork.on('tokenAboutToExpire', function () {
                            (async () => {
                                //get new realtime token
                                const r = await callAPI(solution, `${apiEndpoint}token`, {}, 'GET');
                                _window.realtimeNetwork.updateToken(r.token);
                            })();
                        });

                        _window.realtimeNetwork.on('tokenExpired', function () {
                            (async () => {
                                //get new realtime token
                                const r = await callAPI(solution, `${apiEndpoint}token`, {}, 'GET');
                                _window.realtimeNetwork.updateToken(r.token);
                            })();
                        });

                        _window.realtimeNetwork.subscriptions = {};
                        if (_track) console.log('realtime.syncClient.success', { retry });
                        if (isFunction(onSuccess)) onSuccess('CREATED');
                    }
                }
                catch (error) {
                    delete _window.realtimeNetwork;
                    console.error('realtime.syncClient.error', error);
                    setError(error);
                }
            }
            else {
                if (_track) console.log('realtime.syncClient.existing', { retry });
                if (isFunction(onSuccess)) onSuccess('EXISTING');
            }

            setConnected(isGoodNetwork());
        })();
    }, [retry]);

    useEffect(() => {
        if (retry < retryCount) {
            const timeout = setTimeout(() => {
                if (_track) console.log('realtime.syncClient.retrying', { retry, connected });
                if (!connected) {
                    setRetry(() => { return retry + 1 });
                }
            }, 3000);
            return () => clearInterval(timeout)
        }
        else {
            if (_track) console.error(`realtime.useRealtimeSession.retried ${retry} times.`);
            if (isFunction(onError)) onError(error);
            return () => { }
        }
    }, [retry]);


    return connected;
}


const initSync = async (type: 'Document' | 'List', syncId: string, onEvent: any) => {
    return new Promise((resolve, reject) => {
        const cacheKey = `${type}-${syncId}`;
        const instance = _window.realtimeNetwork.subscriptions[cacheKey];
        if (_track) console.log('realtime.subscribeSyncClient.try', type, syncId, instance);
        if (!instance) {
            if (_track) console.log('realtime.subscribeSyncClient.start', type, syncId);
            _window.realtimeNetwork.subscriptions[cacheKey] = { start: new Date() };
            _window.realtimeNetwork[type.toLowerCase()](syncId)
                .then((result: any) => {
                    if (_track) console.log('realtime.subscribeSyncClient.success', syncId, result);

                    result.on('updated', function (event: any) {
                        onEvent({ type: 'DOC_UPDATED', data: event.data, syncId });
                    });
                    result.on('itemAdded', function (args: Record<string, any>) {
                        onEvent({ type: 'ITEM_ADDED', data: args.item, syncId });
                    });
                    result.on('itemRemoved', function (args: Record<string, any>) {
                        onEvent({ type: 'ITEM_REMOVED', data: args.item, syncId });
                    });
                    result.on('itemUpdated', function (args: Record<string, any>) {
                        onEvent({ type: 'ITEM_UPDATED', data: args.item, syncId });
                    });

                    _window.realtimeNetwork.subscriptions[cacheKey].end = new Date();
                    if (_track) console.log('realtime.subscribeSyncClient.finish', type, syncId);
                    resolve(syncId);
                })
                .catch((error: any) => {
                    console.error('realtime.subscribeSyncClient.failed', type, syncId, error);
                    delete _window.realtimeNetwork.subscriptions[cacheKey];
                    reject(error);
                });
        }
        else {
            if (_track) console.log('realtime.subscribeSyncClient.existing', type, syncId, instance);
            resolve(syncId);
        }
    });
}

export const useRealtimeSession = (
    type: 'Document' | 'List',
    syncId: string,
    onEvent: any,
    onError?: any,
    settings?: {
        retryCount?: number
    }
): string | null => {

    const networkConnected = currentRealtimeNetwork();
    const [connected, setConnected] = useState<string | null>(null);
    const [retry, setRetry] = useState(-1);
    const [currentSyncId, setCurrentSyncId] = useState('');
    const [error, setError] = useState(null);

    settings = isObject(settings) ? settings : {};
    const retryCount = settings && isNumber(settings?.retryCount) && settings?.retryCount > 0 ? settings.retryCount : 5;

    if (_track) console.log({ networkConnected, type, currentSyncId });

    useEffect(() => {
        //STEP 1
        if (networkConnected && isNonEmptyString(syncId)) {
            setCurrentSyncId(syncId);
            setConnected(null);
            //kick off retry from 1
            if (_track) console.log('realtime.useRealtimeSession.newSyncId', { retry, connected, currentSyncId });
            setRetry(1);
        }
    }, [syncId, networkConnected])

    useEffect(() => {
        //STEP 2: Start trying to initSync
        if (retry > 0) {
            if (_track) console.log('realtime.useRealtimeSession.initSync', { retry, connected, currentSyncId });
            initSync(type, syncId, onEvent)
                .then(() => {
                    if (_track) console.log('realtime.useRealtimeSession.synced', { retry, connected, currentSyncId });
                    setConnected(currentSyncId);
                })
                .catch((error: any) => {
                    setError(error);
                    console.error(error);
                })
        }
    }, [retry]);

    useEffect(() => {

        //STEP 3: retry every 3s until retryCount times
        if (retry > 0 && retry < retryCount) {
            const timeout = setTimeout(() => {
                if (!connected) {
                    if (_track) console.log('realtime.useRealtimeSession.retry', { retry: retry + 1, connected, currentSyncId });
                    setRetry(() => { return retry + 1 });
                }
            }, 3000);
            return () => clearInterval(timeout)
        }
        else {
            if (_track) console.error(`realtime.useRealtimeSession.retried ${retry} times.`);
            if (isFunction(onError)) onError(error);
            return () => { }
        }
    }, [retry]);

    return connected;
};